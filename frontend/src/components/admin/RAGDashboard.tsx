import { useEffect, useState } from "react";
import { useAuth } from "../../stores/AuthContext";
import { ragApi } from "../../api";
import type {
  RAGSummary, RAGSubjectStat, RAGTraceEntry,
  EvalRunSummary, EvalCaseResult, EvalRunDetail,
} from "../../types";

interface Props {
  onBack: () => void;
}

type Period = 1 | 7 | 30;

export function RAGDashboard({ onBack }: Props) {
  const { user } = useAuth();
  const token = user?.firebaseToken ?? "";

  const [period, setPeriod] = useState<Period>(7);
  const [summary, setSummary] = useState<RAGSummary | null>(null);
  const [subjects, setSubjects] = useState<RAGSubjectStat[]>([]);
  const [traces, setTraces] = useState<RAGTraceEntry[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    Promise.all([
      ragApi.summary(token, period),
      ragApi.bySubject(token, period),
      ragApi.recent(token, 50),
      ragApi.evalRuns(token),
    ])
      .then(([s, sub, r, ev]) => {
        setSummary(s);
        setSubjects(sub.subjects);
        setTraces(r.traces);
        setEvalRuns(ev.runs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, period]);

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-ai px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-base">RAG Observatory</p>
            <p className="text-white/70 text-xs mt-0.5">Pipeline health & quality metrics</p>
          </div>
          <button
            onClick={onBack}
            className="text-white/70 hover:text-white text-xs px-2 py-1.5 rounded min-h-[36px]
                       focus:outline-none focus:ring-2 focus:ring-white"
          >
            ← Back
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          {([1, 7, 30] as Period[]).map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`text-xs px-3 py-1.5 rounded-full min-h-[32px] transition-colors ${
                period === d
                  ? "bg-white text-rusty-ai font-bold"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {d === 1 ? "24h" : d === 7 ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {loading && (
          <div className="text-center py-12 text-rusty-muted">Loading metrics...</div>
        )}
        {error && (
          <div className="bg-rusty-danger-soft text-rusty-danger p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {summary && !loading && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Queries" value={summary.total_queries.toLocaleString()} />
              <StatCard
                label="Avg Latency"
                value={`${(summary.avg_total_ms / 1000).toFixed(1)}s`}
                sub={summary.avg_total_ms > 10000 ? "Slow" : "OK"}
                warn={summary.avg_total_ms > 10000}
              />
              <StatCard
                label="Error Rate"
                value={`${summary.error_rate}%`}
                warn={summary.error_rate > 5}
              />
              <StatCard
                label="Empty Rate"
                value={`${summary.empty_rate}%`}
                sub="No results"
                warn={summary.empty_rate > 20}
              />
            </div>

            {/* Latency Breakdown */}
            <Section title="Latency Breakdown">
              <LatencyBar
                embed={summary.avg_embed_ms}
                retrieval={summary.avg_retrieval_ms}
                llm={summary.avg_llm_ms}
                total={summary.avg_total_ms}
              />
            </Section>

            {/* Token Usage */}
            <Section title="Token Usage">
              <div className="flex justify-between text-sm">
                <span className="text-rusty-muted">Total tokens used</span>
                <span className="font-bold text-rusty-ink">
                  {summary.total_tokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-rusty-muted">Avg per query</span>
                <span className="font-bold text-rusty-ink">
                  {summary.avg_tokens_per_query.toLocaleString()}
                </span>
              </div>
            </Section>

            {/* Retrieval Quality */}
            <Section title="Retrieval Quality">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="Avg Vector Hits" value={summary.avg_vector_hits.toFixed(1)} />
                <MiniStat label="Avg BM25 Hits" value={summary.avg_bm25_hits.toFixed(1)} />
                <MiniStat label="Avg RRF Chunks" value={summary.avg_rrf_chunks.toFixed(1)} />
                <MiniStat
                  label="Fallback Rate"
                  value={`${summary.fallback_rate}%`}
                  warn={summary.fallback_rate > 10}
                />
                <MiniStat
                  label="JSON Fail Rate"
                  value={`${summary.json_fail_rate}%`}
                  warn={summary.json_fail_rate > 5}
                />
                <MiniStat
                  label="Vector Top Score"
                  value={summary.avg_vector_top_score.toFixed(3)}
                />
              </div>
            </Section>

            {/* By Subject */}
            {subjects.length > 0 && (
              <Section title="By Subject">
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <div
                      key={s.subject}
                      className="flex items-center justify-between p-3 bg-rusty-cream rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-bold text-rusty-ink capitalize">{s.subject}</p>
                        <p className="text-xs text-rusty-muted">
                          {s.count} queries · {(s.avg_ms / 1000).toFixed(1)}s avg
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-rusty-muted">
                          {s.tokens.toLocaleString()} tokens
                        </p>
                        {s.error_rate > 0 && (
                          <p className="text-xs text-rusty-danger">{s.error_rate}% errors</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Eval Results */}
            {evalRuns.length > 0 && (
              <Section title="Eval Results">
                <EvalSection runs={evalRuns} token={token} />
              </Section>
            )}

            {/* Recent Traces */}
            {traces.length > 0 && (
              <Section title="Recent Queries">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {traces.map((t) => (
                    <TraceRow key={t.trace_id} trace={t} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border ${
        warn ? "bg-rusty-warning-soft border-rusty-warning" : "bg-rusty-cream border-rusty-border"
      }`}
    >
      <p className="text-xs text-rusty-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${warn ? "text-rusty-warning" : "text-rusty-ink"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-rusty-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-rusty-cream border border-rusty-border rounded-2xl p-4">
      <p className="text-sm font-bold text-rusty-ink mb-3">{title}</p>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-rusty-muted">{label}</span>
      <span className={`font-bold ${warn ? "text-rusty-warning" : "text-rusty-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function LatencyBar({
  embed,
  retrieval,
  llm,
  total,
}: {
  embed: number;
  retrieval: number;
  llm: number;
  total: number;
}) {
  if (total === 0) return <p className="text-sm text-rusty-muted">No data</p>;

  const embedPct = Math.max((embed / total) * 100, 2);
  const retrievalPct = Math.max((retrieval / total) * 100, 2);
  const llmPct = Math.max((llm / total) * 100, 2);

  return (
    <div>
      <div className="flex rounded-full h-6 overflow-hidden">
        <div
          className="bg-rusty-ai flex items-center justify-center"
          style={{ width: `${embedPct}%` }}
          title={`Embed: ${embed.toFixed(0)}ms`}
        >
          {embedPct > 10 && <span className="text-[10px] text-white">Embed</span>}
        </div>
        <div
          className="bg-rusty-green flex items-center justify-center"
          style={{ width: `${retrievalPct}%` }}
          title={`Retrieval: ${retrieval.toFixed(0)}ms`}
        >
          {retrievalPct > 10 && <span className="text-[10px] text-white">Search</span>}
        </div>
        <div
          className="bg-rusty-terracotta flex items-center justify-center"
          style={{ width: `${llmPct}%` }}
          title={`LLM: ${llm.toFixed(0)}ms`}
        >
          {llmPct > 10 && <span className="text-[10px] text-white">LLM</span>}
        </div>
      </div>
      <div className="flex justify-between mt-2 text-xs text-rusty-muted">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-rusty-ai mr-1" />
          Embed {embed.toFixed(0)}ms
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-rusty-green mr-1" />
          Search {retrieval.toFixed(0)}ms
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-rusty-terracotta mr-1" />
          LLM {llm.toFixed(0)}ms
        </span>
      </div>
      <p className="text-center text-sm font-bold text-rusty-ink mt-2">
        Total: {(total / 1000).toFixed(1)}s
      </p>
    </div>
  );
}

function EvalSection({ runs, token }: { runs: EvalRunSummary[]; token: string }) {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvalRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleSelect = (filename: string) => {
    if (selectedRun === filename) {
      setSelectedRun(null);
      setDetail(null);
      return;
    }
    setSelectedRun(filename);
    setLoadingDetail(true);
    ragApi
      .evalRunDetail(filename, token)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  };

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const pct = run.total > 0 ? Math.round((run.passed / run.total) * 100) : 0;
        const isGood = pct >= 90;
        const isWarn = pct >= 70 && pct < 90;
        const isOpen = selectedRun === run.filename;

        return (
          <div key={run.filename}>
            <button
              onClick={() => handleSelect(run.filename)}
              className="w-full text-left p-3 rounded-xl border bg-white border-rusty-border
                         hover:bg-rusty-sand transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-rusty-ink">{run.dataset}</p>
                  <p className="text-xs text-rusty-muted mt-0.5">
                    {run.mode} · {new Date(run.timestamp).toLocaleDateString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    isGood ? "text-rusty-green" : isWarn ? "text-rusty-warning" : "text-rusty-danger"
                  }`}>
                    {run.passed}/{run.total}
                  </p>
                  <p className={`text-xs font-bold ${
                    isGood ? "text-rusty-green" : isWarn ? "text-rusty-warning" : "text-rusty-danger"
                  }`}>
                    {pct}% pass
                  </p>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="mt-1 ml-2 space-y-1">
                {loadingDetail && (
                  <p className="text-xs text-rusty-muted py-2">Loading details...</p>
                )}
                {detail && detail.results.map((c) => (
                  <EvalCaseRow key={c.case_id} c={c} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvalCaseRow({ c }: { c: EvalCaseResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`p-2.5 rounded-lg border text-xs ${
        c.passed
          ? "bg-white border-rusty-border"
          : "bg-rusty-danger-soft border-rusty-danger"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`font-bold text-sm mt-px ${c.passed ? "text-rusty-green" : "text-rusty-danger"}`}>
          {c.passed ? "P" : "F"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-rusty-ink font-medium leading-snug truncate">
            {c.question}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-rusty-muted">
            <span>{c.category}</span>
            <span>{c.latency_s.toFixed(1)}s</span>
            {c.retrieval_correct !== null && (
              <span>Retr: {c.retrieval_correct ? "Y" : "N"}</span>
            )}
            {c.coverage_pass !== null && (
              <span>Cov: {Math.round(c.coverage_score * 100)}%</span>
            )}
            {c.exact_match_found !== null && (
              <span>Exact: {c.exact_match_found ? "Y" : "N"}</span>
            )}
            {c.groundedness !== null && (
              <span>Ground: {Math.round(c.groundedness * 100)}%</span>
            )}
          </div>
          {c.failures.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-rusty-danger font-bold hover:underline focus:outline-none
                         min-h-[24px]"
            >
              {expanded ? "▾ Hide" : `▸ ${c.failures.length} issue${c.failures.length > 1 ? "s" : ""}`}
            </button>
          )}
          {expanded && (
            <div className="mt-1 space-y-0.5">
              {c.failures.map((f, i) => (
                <p key={i} className="text-rusty-danger leading-snug">{f}</p>
              ))}
              {c.notes_preview && (
                <p className="text-rusty-muted mt-1 leading-snug">
                  Response: {c.notes_preview}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceRow({ trace: t }: { trace: RAGTraceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasError = !!t.error;
  const isEmpty = t.empty_response;
  const hasPreview = t.retrieved_chunks_preview.length > 0 || t.llm_response_preview;

  return (
    <div
      className={`p-3 rounded-xl border text-xs ${
        hasError
          ? "bg-rusty-danger-soft border-rusty-danger"
          : isEmpty
          ? "bg-rusty-warning-soft border-rusty-warning"
          : "bg-white border-rusty-border"
      }`}
    >
      {t.query_text && (
        <p className="text-sm text-rusty-ink font-medium mb-1.5 leading-snug">
          &ldquo;{t.query_text}&rdquo;
        </p>
      )}
      <div className="flex justify-between items-start">
        <div>
          <span className="font-bold text-rusty-ink capitalize">{t.subject}</span>
          <span className="text-rusty-muted ml-2">
            {t.mode} · Class {t.class_num}
          </span>
          {t.chapter && <span className="text-rusty-muted"> · {t.chapter}</span>}
        </div>
        <span className="text-rusty-muted whitespace-nowrap">
          {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="flex gap-3 mt-1.5 text-rusty-muted">
        <span>{(t.total_ms / 1000).toFixed(1)}s</span>
        <span>{t.llm_total_tokens} tok</span>
        <span>
          V:{t.vector_hits} B:{t.bm25_hits} R:{t.rrf_chunks}
        </span>
        <span className="text-rusty-ai">{t.llm_model}</span>
      </div>
      {hasError && <p className="text-rusty-danger mt-1 font-bold">{t.error}</p>}
      {isEmpty && !hasError && (
        <p className="text-rusty-warning mt-1">Empty response — no results from textbooks</p>
      )}
      {hasPreview && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-rusty-ai font-bold hover:underline focus:outline-none
                     min-h-[28px] px-1"
        >
          {expanded ? "▾ Hide content" : "▸ View content"}
        </button>
      )}
      {expanded && (
        <div className="mt-2 space-y-2">
          {t.retrieved_chunks_preview.length > 0 && (
            <div>
              <p className="font-bold text-rusty-ink mb-1">
                Retrieved Chunks ({t.retrieved_chunks_preview.length})
              </p>
              <div className="space-y-1">
                {t.retrieved_chunks_preview.map((chunk, i) => (
                  <div
                    key={i}
                    className="bg-rusty-sand rounded-lg p-2 text-rusty-muted leading-relaxed"
                  >
                    <span className="text-rusty-ai font-bold mr-1">#{i + 1}</span>
                    {chunk}
                  </div>
                ))}
              </div>
            </div>
          )}
          {t.llm_response_preview && (
            <div>
              <p className="font-bold text-rusty-ink mb-1">LLM Output</p>
              <pre
                className="bg-rusty-sand rounded-lg p-2 text-rusty-muted whitespace-pre-wrap
                           break-words leading-relaxed overflow-x-auto max-h-40 overflow-y-auto"
              >
                {t.llm_response_preview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
