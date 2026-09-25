import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { studentApi } from "../../api";
import { SkeletonCard } from "../shared/SkeletonCard";
import type { StudentProgress, ProgressSubject, ProgressTimelineEntry } from "../../types";

const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: "📐", science: "🔬", hindi: "अ", social_science: "🌍", english: "📖",
};

function pctColor(pct: number): string {
  if (pct >= 80) return "text-rusty-success-dark";
  if (pct >= 60) return "text-rusty-warning-dark";
  return "text-red-600";
}

function pctBg(pct: number): string {
  if (pct >= 80) return "bg-rusty-success-soft";
  if (pct >= 60) return "bg-rusty-warning-soft";
  return "bg-red-50";
}

function pctBorder(pct: number): string {
  if (pct >= 80) return "border-green-200";
  if (pct >= 60) return "border-yellow-200";
  return "border-red-200";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

interface Props {
  onBack: () => void;
}

export function MyProgress({ onBack }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    studentApi
      .progress(user.firebaseToken)
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to load progress"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      {/* Header */}
      <header className="bg-rusty-green text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Back"
          className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                     rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">
          ←
        </button>
        <p className="font-semibold text-sm flex-1">My Progress</p>
        {data && data.study_streak_days > 0 && (
          <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">
            🔥 {data.study_streak_days} day streak
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={4} />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-14">
            <p className="text-3xl mb-3">⚠️</p>
            <p className="text-rusty-ink font-semibold text-sm">Something went wrong</p>
            <p className="text-rusty-muted text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.total_tests === 0 && (
          <div className="text-center py-14">
            <p className="text-3xl mb-3">📊</p>
            <p className="text-rusty-ink font-semibold text-sm">No progress yet</p>
            <p className="text-rusty-muted text-xs mt-1">
              Take a test to start tracking your progress!
            </p>
          </div>
        )}

        {/* Main content */}
        {!loading && !error && data && data.total_tests > 0 && (
          <>
            {/* ── Summary cards ────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {/* Overall score */}
              <div className={`rounded-xl p-3 text-center border ${pctBg(data.overall_pct)} ${pctBorder(data.overall_pct)}`}>
                <p className={`text-2xl font-bold ${pctColor(data.overall_pct)}`}>
                  {Math.round(data.overall_pct)}%
                </p>
                <p className="text-[11px] text-rusty-muted mt-0.5">Overall</p>
              </div>

              {/* Tests taken */}
              <div className="bg-rusty-cream border border-rusty-border rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rusty-ink">{data.total_tests}</p>
                <p className="text-[11px] text-rusty-muted mt-0.5">Tests</p>
              </div>

              {/* Streak */}
              <div className="bg-rusty-cream border border-rusty-border rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rusty-ink">
                  {data.study_streak_days > 0 ? `🔥${data.study_streak_days}` : "0"}
                </p>
                <p className="text-[11px] text-rusty-muted mt-0.5">Streak</p>
              </div>
            </div>

            {/* ── By subject ──────────────────────────── */}
            {data.by_subject.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-rusty-ink mb-2.5">By Subject</h2>
                <div className="space-y-3">
                  {data.by_subject.map((s: ProgressSubject) => (
                    <SubjectCard key={s.subject} subject={s} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Timeline ────────────────────────────── */}
            {data.timeline.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-rusty-ink mb-2.5">Recent Tests</h2>
                <div className="space-y-2">
                  {data.timeline.map((entry: ProgressTimelineEntry, idx: number) => (
                    <TimelineRow key={`${entry.date}-${idx}`} entry={entry} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Subject card ────────────────────────────────────────────── */

function SubjectCard({ subject: s }: { subject: ProgressSubject }) {
  const emoji = SUBJECT_EMOJI[s.subject] ?? "📚";
  const pct = Math.round(s.average_pct);

  return (
    <div className="bg-rusty-cream border border-rusty-border rounded-xl p-3.5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${pctBg(pct)}`}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-rusty-ink capitalize">
              {s.subject.replace("_", " ")}
            </p>
            <p className={`text-sm font-bold ${pctColor(pct)}`}>{pct}%</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-rusty-muted">
              {s.tests_taken} test{s.tests_taken !== 1 ? "s" : ""} &middot; {s.score}/{s.total}
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-rusty-border rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Weak topics */}
      {s.weak_topics.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {s.weak_topics.map((wt) => (
            <span
              key={wt.topic}
              className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full"
            >
              {wt.topic} ({wt.count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Timeline row ────────────────────────────────────────────── */

function TimelineRow({ entry }: { entry: ProgressTimelineEntry }) {
  const emoji = SUBJECT_EMOJI[entry.subject] ?? "📚";
  const pct = Math.round(entry.pct);

  return (
    <div className="flex items-center gap-3 p-3 bg-rusty-cream border border-rusty-border rounded-xl">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${pctBg(pct)}`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-rusty-ink capitalize truncate">
          {entry.subject.replace("_", " ")} &middot; {entry.chapter}
        </p>
        <p className="text-[11px] text-rusty-muted mt-0.5">
          {formatDate(entry.date)} &middot; {relativeTime(entry.date)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
          entry.source === "practice"
            ? "bg-rusty-ai-soft text-rusty-ai"
            : "bg-rusty-warning-soft text-rusty-warning-dark"
        }`}>
          {entry.source}
        </span>
        <div className="text-right">
          <p className={`text-sm font-bold ${pctColor(pct)}`}>{pct}%</p>
          <p className="text-[10px] text-rusty-muted">{entry.score}/{entry.total}</p>
        </div>
      </div>
    </div>
  );
}
