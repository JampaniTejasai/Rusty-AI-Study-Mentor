"""
Student-facing endpoints — progress tracking.
Shows a student's own performance over time, without exposing other students' data.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import select, func, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import StudentDep, DBDep
from app.models.score import QuizScore
from app.models.attempt import TestAttempt, AttemptAnswer
from app.models.test import Test

router = APIRouter()

VALID_SUBJECTS = {"mathematics", "science", "hindi", "social_science", "english"}


@router.get("/progress")
async def my_progress(
    user: StudentDep,
    db: DBDep,
    days: int = Query(default=30, ge=7, le=365),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    sid = user.student_id

    scores = await db.execute(
        select(QuizScore)
        .where(QuizScore.student_id == sid)
        .where(QuizScore.taken_at >= cutoff)
        .order_by(QuizScore.taken_at.asc())
    )
    score_rows = scores.scalars().all()

    attempts = await db.execute(
        select(TestAttempt)
        .where(TestAttempt.student_id == sid)
        .where(TestAttempt.started_at >= cutoff)
        .order_by(TestAttempt.started_at.asc())
    )
    attempt_rows = attempts.scalars().all()

    total_tests = len(score_rows) + len([a for a in attempt_rows if a.submitted_at])
    total_score = sum(s.score for s in score_rows)
    total_possible = sum(s.total for s in score_rows)
    for a in attempt_rows:
        if a.submitted_at and a.score is not None:
            total_score += a.score
            total_possible += 5

    overall_pct = round((total_score / total_possible * 100) if total_possible else 0, 1)

    by_subject: dict[str, dict] = {}
    for s in score_rows:
        bucket = by_subject.setdefault(s.subject, {"score": 0, "total": 0, "count": 0, "weak": []})
        bucket["score"] += s.score
        bucket["total"] += s.total
        bucket["count"] += 1
        if s.weak_topics:
            bucket["weak"].extend(s.weak_topics)

    subjects_out = []
    for subj, b in by_subject.items():
        pct = round((b["score"] / b["total"] * 100) if b["total"] else 0, 1)
        weak_counts: dict[str, int] = {}
        for t in b["weak"]:
            weak_counts[t] = weak_counts.get(t, 0) + 1
        top_weak = sorted(weak_counts.items(), key=lambda x: -x[1])[:5]

        subjects_out.append({
            "subject": subj,
            "tests_taken": b["count"],
            "average_pct": pct,
            "score": b["score"],
            "total": b["total"],
            "weak_topics": [{"topic": t, "count": c} for t, c in top_weak],
        })

    timeline = []
    for s in score_rows:
        timeline.append({
            "date": s.taken_at.isoformat(),
            "subject": s.subject,
            "chapter": s.chapter or "",
            "score": s.score,
            "total": s.total,
            "pct": round(s.score / s.total * 100 if s.total else 0, 1),
            "source": "quiz",
        })
    for a in attempt_rows:
        if a.submitted_at and a.score is not None:
            test_obj = await db.get(Test, a.test_id)
            timeline.append({
                "date": a.submitted_at.isoformat(),
                "subject": test_obj.subject if test_obj else "",
                "chapter": (test_obj.chapter or "") if test_obj else "",
                "score": a.score,
                "total": 5,
                "pct": round(a.score / 5 * 100, 1),
                "source": "practice",
            })

    timeline.sort(key=lambda x: x["date"])

    streak = _calc_streak(timeline)

    return {
        "period_days": days,
        "total_tests": total_tests,
        "overall_pct": overall_pct,
        "total_score": total_score,
        "total_possible": total_possible,
        "by_subject": subjects_out,
        "timeline": timeline,
        "study_streak_days": streak,
    }


def _calc_streak(timeline: list[dict]) -> int:
    if not timeline:
        return 0
    dates = sorted({e["date"][:10] for e in timeline}, reverse=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if dates[0] != today:
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        if dates[0] != yesterday:
            return 0

    streak = 1
    for i in range(1, len(dates)):
        prev = datetime.strptime(dates[i - 1], "%Y-%m-%d")
        curr = datetime.strptime(dates[i], "%Y-%m-%d")
        if (prev - curr).days == 1:
            streak += 1
        else:
            break
    return streak
