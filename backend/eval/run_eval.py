#!/usr/bin/env python3
"""
Rusty RAG Evaluation Framework.

Runs eval cases against the study API, fetches trace data for each query,
scores retrieval quality + answer correctness, and generates a report.

Usage:
    cd backend
    python -m eval.run_eval
    python -m eval.run_eval --dataset eval/custom.json
    python -m eval.run_eval --base-url https://prod.example.com
    python -m eval.run_eval --mode test   # eval test generation instead
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

import httpx

DEFAULTS = {
    "base_url": "http://localhost:8000",
    "student_id": "KHEL-2026-001",
    "student_pin": "1234",
    "admin_id": "KHEL-2026-ADM1",
    "admin_pin": "0000",
    "latency_threshold": 30.0,
    "coverage_threshold": 0.5,
}

NOT_FOUND_MARKERS = [
    "couldn't find", "नहीं मिला",
    "not mentioned in", "not provided in", "not contain",
    "does not mention", "do not contain", "not found in",
    "no information about", "not related to", "not relevant",
    "are not provided", "is not provided",
    "jokes are not", "not in the given", "not in the provided",
]


# ── Data structures ──────────────────────────────────────────


@dataclass
class EvalCase:
    id: str
    question: str
    chapter: str | None = None
    expected_chapter: str | None = None
    expected_keywords: list[str] = field(default_factory=list)
    exact_match: str | None = None
    should_answer: bool = True
    category: str = "general"
    medium: str = "en"


@dataclass
class CaseResult:
    case_id: str
    question: str
    category: str
    passed: bool = False

    retrieval_correct: bool | None = None
    coverage_score: float = 0.0
    coverage_pass: bool | None = None
    exact_match_found: bool | None = None
    scope_correct: bool = False
    groundedness: float | None = None
    latency_s: float = 0.0
    latency_ok: bool = True

    notes_preview: str = ""
    key_points_count: int = 0
    chunks_retrieved: int = 0
    source_chapters: list[str] = field(default_factory=list)
    error: str | None = None

    vector_hits: int = 0
    bm25_hits: int = 0
    rrf_chunks: int = 0
    vector_top_score: float = 0.0
    llm_tokens: int = 0
    llm_json_valid: bool = True

    failures: list[str] = field(default_factory=list)


# ── Helpers ──────────────────────────────────────────────────


def _login(client: httpx.Client, base_url: str, sid: str, pin: str) -> str:
    resp = client.post(
        f"{base_url}/auth/login",
        json={"student_id": sid, "pin": pin},
    )
    resp.raise_for_status()
    return resp.json()["firebase_token"]


def _is_empty_response(notes: str, source_chunks: int) -> bool:
    if source_chunks == 0:
        return True
    return any(m in notes.lower() for m in NOT_FOUND_MARKERS)


def _full_text(notes: str, key_points: list[str]) -> str:
    return (notes + " " + " ".join(key_points)).lower()


# ── Runner ───────────────────────────────────────────────────


def run_study_case(
    client: httpx.Client,
    base_url: str,
    student_token: str,
    admin_token: str,
    case: EvalCase,
    subject: str,
    class_num: int,
    latency_threshold: float,
    coverage_threshold: float,
) -> CaseResult:
    result = CaseResult(
        case_id=case.id, question=case.question, category=case.category
    )

    start = time.perf_counter()
    try:
        resp = client.post(
            f"{base_url}/study/query",
            json={
                "query": case.question,
                "subject": subject,
                "chapter": case.chapter,
                "history": [],
                "medium": case.medium,
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        result.latency_s = time.perf_counter() - start
        result.error = str(exc)[:200]
        result.failures.append(f"API error: {result.error}")
        return result

    result.latency_s = time.perf_counter() - start

    notes = data.get("notes", "")
    key_points = data.get("key_points", [])
    sources = data.get("sources", [])
    source_chunks = data.get("source_chunks", 0)

    result.notes_preview = notes[:200]
    result.key_points_count = len(key_points)
    result.chunks_retrieved = source_chunks
    result.source_chapters = list(
        {s["chapter"] for s in sources if s.get("chapter")}
    )

    is_empty = _is_empty_response(notes, source_chunks)
    text = _full_text(notes, key_points)

    # 1. Scope
    if case.should_answer:
        result.scope_correct = not is_empty
        if is_empty:
            result.failures.append("Expected answer but got empty response")
    else:
        result.scope_correct = is_empty
        if not is_empty:
            result.failures.append(
                f"Expected empty (out-of-scope) but got: {notes[:80]}"
            )

    # 2. Retrieval chapter match
    if case.should_answer and case.expected_chapter and not is_empty:
        result.retrieval_correct = case.expected_chapter in result.source_chapters
        if not result.retrieval_correct:
            result.failures.append(
                f"Chapter mismatch: expected '{case.expected_chapter}', "
                f"got {result.source_chapters}"
            )

    # 3. Keyword coverage
    if case.should_answer and case.expected_keywords and not is_empty:
        found = sum(1 for kw in case.expected_keywords if kw.lower() in text)
        total = len(case.expected_keywords)
        result.coverage_score = found / total
        result.coverage_pass = result.coverage_score >= coverage_threshold
        if not result.coverage_pass:
            missing = [kw for kw in case.expected_keywords if kw.lower() not in text]
            result.failures.append(
                f"Coverage {found}/{total} ({result.coverage_score:.0%}), "
                f"missing: {missing}"
            )

    # 4. Exact match
    if case.exact_match and case.should_answer and not is_empty:
        result.exact_match_found = case.exact_match.lower() in text
        if not result.exact_match_found:
            result.failures.append(
                f"Exact match '{case.exact_match}' not found in response"
            )

    # 5. Latency
    result.latency_ok = result.latency_s <= latency_threshold
    if not result.latency_ok:
        result.failures.append(
            f"Latency {result.latency_s:.1f}s exceeds {latency_threshold}s"
        )

    # 6. Trace data (best-effort)
    try:
        tr = client.get(
            f"{base_url}/admin/rag/recent?limit=1",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        if tr.status_code == 200:
            traces = tr.json().get("traces", [])
            if traces:
                t = traces[0]
                result.vector_hits = t.get("vector_hits", 0)
                result.bm25_hits = t.get("bm25_hits", 0)
                result.rrf_chunks = t.get("rrf_chunks", 0)
                result.vector_top_score = t.get("vector_top_score", 0.0)
                result.llm_tokens = t.get("llm_total_tokens", 0)
                result.llm_json_valid = t.get("llm_json_valid", True)
                kept = t.get("ground_check_kept", 0)
                dropped = t.get("ground_check_dropped", 0)
                if kept + dropped > 0:
                    result.groundedness = round(kept / (kept + dropped), 3)
    except Exception:
        pass

    # Overall pass/fail
    checks = [result.scope_correct, result.latency_ok]
    if result.retrieval_correct is not None:
        checks.append(result.retrieval_correct)
    if result.coverage_pass is not None:
        checks.append(result.coverage_pass)
    if result.exact_match_found is not None:
        checks.append(result.exact_match_found)
    result.passed = all(checks) and result.error is None

    return result


def run_test_case(
    client: httpx.Client,
    base_url: str,
    student_token: str,
    admin_token: str,
    case: EvalCase,
    subject: str,
    class_num: int,
    latency_threshold: float,
    **_,
) -> CaseResult:
    result = CaseResult(
        case_id=case.id, question=case.question, category=case.category
    )

    start = time.perf_counter()
    try:
        resp = client.post(
            f"{base_url}/test/generate",
            json={
                "subject": subject,
                "chapter": case.chapter,
                "medium": case.medium,
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        result.latency_s = time.perf_counter() - start
        result.error = str(exc)[:200]
        result.failures.append(f"API error: {result.error}")
        return result

    result.latency_s = time.perf_counter() - start

    questions = data.get("questions", [])
    result.key_points_count = len(questions)

    if case.should_answer:
        result.scope_correct = len(questions) > 0
        if not result.scope_correct:
            result.failures.append("Expected MCQs but got none")
    else:
        result.scope_correct = len(questions) == 0

    for q in questions:
        opts = q.get("options", {})
        vals = [opts.get("A", ""), opts.get("B", ""), opts.get("C", ""), opts.get("D", "")]
        if len(set(v.strip().lower() for v in vals)) < 4:
            result.failures.append(f"Q{q.get('question_no')}: duplicate options")

    result.latency_ok = result.latency_s <= latency_threshold
    if not result.latency_ok:
        result.failures.append(
            f"Latency {result.latency_s:.1f}s exceeds {latency_threshold}s"
        )

    try:
        tr = client.get(
            f"{base_url}/admin/rag/recent?limit=1",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        if tr.status_code == 200:
            traces = tr.json().get("traces", [])
            if traces:
                t = traces[0]
                result.rrf_chunks = t.get("rrf_chunks", 0)
                result.llm_tokens = t.get("llm_total_tokens", 0)
                mcq_gen = t.get("mcq_generated", 0)
                mcq_drop = t.get("mcq_dropped", 0)
                if mcq_gen > 0:
                    result.groundedness = round(
                        (mcq_gen - mcq_drop) / mcq_gen, 3
                    )
    except Exception:
        pass

    checks = [result.scope_correct, result.latency_ok]
    result.passed = all(checks) and not result.failures and result.error is None
    return result


# ── Report ───────────────────────────────────────────────────

C_PASS = "\033[92m"
C_FAIL = "\033[91m"
C_WARN = "\033[93m"
C_DIM = "\033[90m"
C_BOLD = "\033[1m"
C_END = "\033[0m"


def _check(val: bool | None) -> str:
    if val is None:
        return f"{C_DIM}-{C_END}"
    return f"{C_PASS}Y{C_END}" if val else f"{C_FAIL}N{C_END}"


def print_report(
    dataset_name: str,
    base_url: str,
    mode: str,
    results: list[CaseResult],
) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    print(f"\n{C_BOLD}{'=' * 66}{C_END}")
    print(f"{C_BOLD}  Rusty RAG Evaluation Report{C_END}")
    print(f"  Dataset : {dataset_name}")
    print(f"  Mode    : {mode}")
    print(f"  Endpoint: {base_url}")
    print(f"  Date    : {now}  |  {len(results)} cases")
    print(f"{C_BOLD}{'=' * 66}{C_END}\n")

    # Per-case table
    print(
        f"  {'#':>3}  {'ID':<18} {'Result':>6}  "
        f"{'Retr':>4} {'Cov':>5} {'Exact':>5} {'Scope':>5} "
        f"{'Time':>6}  Question"
    )
    print(f"  {'─' * 90}")

    for i, r in enumerate(results, 1):
        status = f"{C_PASS}PASS{C_END}" if r.passed else f"{C_FAIL}FAIL{C_END}"
        cov_str = (
            f"{r.coverage_score:.0%}" if r.coverage_pass is not None else " -"
        )
        print(
            f"  {i:>3}  {r.case_id:<18} {status}  "
            f"{_check(r.retrieval_correct):>8} {cov_str:>5} "
            f"{_check(r.exact_match_found):>9} {_check(r.scope_correct):>9} "
            f"{r.latency_s:>5.1f}s  {r.question[:40]}"
        )
        if r.failures:
            for f in r.failures:
                print(f"  {' ' * 5}  {C_FAIL}→ {f}{C_END}")

    # Aggregates
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    answered = [r for r in results if r.retrieval_correct is not None]
    retrieval_ok = sum(1 for r in answered if r.retrieval_correct)

    covered = [r for r in results if r.coverage_pass is not None]
    coverage_ok = sum(1 for r in covered if r.coverage_pass)
    avg_cov = (
        sum(r.coverage_score for r in covered) / len(covered) if covered else 0
    )

    exact = [r for r in results if r.exact_match_found is not None]
    exact_ok = sum(1 for r in exact if r.exact_match_found)

    scope_ok = sum(1 for r in results if r.scope_correct)

    latencies = sorted(r.latency_s for r in results)
    avg_lat = sum(latencies) / len(latencies)
    p95_lat = latencies[int(len(latencies) * 0.95)] if latencies else 0
    total_tokens = sum(r.llm_tokens for r in results)

    grounded = [r for r in results if r.groundedness is not None]
    avg_ground = (
        sum(r.groundedness for r in grounded) / len(grounded)
        if grounded
        else None
    )

    print(f"\n{C_BOLD}{'=' * 66}{C_END}")
    print(f"{C_BOLD}  AGGREGATE SCORES{C_END}")
    print(f"{C_BOLD}{'=' * 66}{C_END}\n")

    rate_color = C_PASS if passed == total else C_WARN if passed >= total * 0.8 else C_FAIL
    print(f"  Pass Rate:           {rate_color}{passed}/{total} ({passed/total:.0%}){C_END}")
    print()
    if answered:
        print(f"  Retrieval Accuracy:  {retrieval_ok}/{len(answered)} ({retrieval_ok/len(answered):.0%})")
    if covered:
        print(f"  Answer Coverage:     {coverage_ok}/{len(covered)} ({coverage_ok/len(covered):.0%})  avg: {avg_cov:.2f}")
    if exact:
        print(f"  Exact Match:         {exact_ok}/{len(exact)} ({exact_ok/len(exact):.0%})")
    print(f"  Scope Handling:      {scope_ok}/{total} ({scope_ok/total:.0%})")
    if avg_ground is not None:
        print(f"  Groundedness:        {avg_ground:.1%}")
    print()
    print(f"  Avg Latency:         {avg_lat:.1f}s")
    print(f"  P95 Latency:         {p95_lat:.1f}s")
    print(f"  Total Tokens:        {total_tokens:,}")

    if failed:
        print(f"\n  {C_FAIL}{C_BOLD}FAILURES ({failed}):{C_END}")
        print(f"  {'─' * 50}")
        for r in results:
            if not r.passed:
                print(f"  {C_FAIL}{r.case_id}{C_END}: {'; '.join(r.failures) or r.error or 'unknown'}")

    print()


# ── Main ─────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description="Rusty RAG Evaluation")
    parser.add_argument(
        "--dataset",
        default="eval/maths08_squares.json",
        help="Path to eval dataset JSON (default: eval/maths08_squares.json)",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULTS["base_url"],
        help=f"API base URL (default: {DEFAULTS['base_url']})",
    )
    parser.add_argument(
        "--student-id", default=DEFAULTS["student_id"],
    )
    parser.add_argument(
        "--student-pin", default=DEFAULTS["student_pin"],
    )
    parser.add_argument(
        "--admin-id", default=DEFAULTS["admin_id"],
    )
    parser.add_argument(
        "--admin-pin", default=DEFAULTS["admin_pin"],
    )
    parser.add_argument(
        "--latency-threshold",
        type=float,
        default=DEFAULTS["latency_threshold"],
        help="Max acceptable latency in seconds (default: 30)",
    )
    parser.add_argument(
        "--coverage-threshold",
        type=float,
        default=DEFAULTS["coverage_threshold"],
        help="Min keyword coverage ratio to pass (default: 0.5)",
    )
    parser.add_argument(
        "--mode",
        choices=["study", "test"],
        default="study",
        help="Eval mode: study (Q&A) or test (MCQ generation)",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        default=True,
        help="Save results JSON to eval/results/ (default: true)",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        print(f"Dataset not found: {dataset_path}", file=sys.stderr)
        return 1

    raw = json.loads(dataset_path.read_text())
    dataset_name = raw.get("name", dataset_path.stem)
    subject = raw["subject"]
    class_num = raw["class_num"]
    default_medium = raw.get("medium", "en")

    cases = []
    for c in raw["cases"]:
        if "medium" not in c:
            c["medium"] = default_medium
        cases.append(EvalCase(**c))

    print(f"\n  Connecting to {args.base_url}...")

    client = httpx.Client(timeout=120.0)

    try:
        student_token = _login(client, args.base_url, args.student_id, args.student_pin)
        admin_token = _login(client, args.base_url, args.admin_id, args.admin_pin)
    except Exception as exc:
        print(f"  Login failed: {exc}", file=sys.stderr)
        return 1

    print(f"  Logged in. Running {len(cases)} eval cases ({args.mode} mode)...\n")

    runner = run_study_case if args.mode == "study" else run_test_case

    results: list[CaseResult] = []
    for i, case in enumerate(cases, 1):
        tag = f"[{i}/{len(cases)}]"
        print(f"  {tag} {case.id:<18} ", end="", flush=True)

        r = runner(
            client=client,
            base_url=args.base_url,
            student_token=student_token,
            admin_token=admin_token,
            case=case,
            subject=subject,
            class_num=class_num,
            latency_threshold=args.latency_threshold,
            coverage_threshold=args.coverage_threshold,
        )
        results.append(r)

        status = f"{C_PASS}PASS{C_END}" if r.passed else f"{C_FAIL}FAIL{C_END}"
        print(f"{status}  {r.latency_s:>5.1f}s  {case.question[:45]}")

    print_report(dataset_name, args.base_url, args.mode, results)

    if args.save:
        results_dir = Path("eval/results")
        results_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = results_dir / f"{dataset_path.stem}_{stamp}.json"
        out_data = {
            "dataset": dataset_name,
            "mode": args.mode,
            "base_url": args.base_url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total": len(results),
            "passed": sum(1 for r in results if r.passed),
            "results": [asdict(r) for r in results],
        }
        out_path.write_text(json.dumps(out_data, indent=2, default=str))
        print(f"  Results saved to: {out_path}\n")

    client.close()
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
