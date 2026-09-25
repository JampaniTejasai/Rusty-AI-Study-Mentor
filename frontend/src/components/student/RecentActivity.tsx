import { useState } from "react";
import type { RecentTestEntry, RecentStudyEntry, Subject } from "../../types";

interface Props {
  tests: RecentTestEntry[];
  study: RecentStudyEntry[];
  onContinueStudy: (subject: Subject, chapter: string | null) => void;
  onRetryTest: (subject: Subject, chapter: string | null) => void;
  onViewAllTests: () => void;
}

const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: "📐", science: "🔬", hindi: "अ", social_science: "🌍", english: "📖",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function RecentActivity({ tests, study, onContinueStudy, onRetryTest, onViewAllTests }: Props) {
  const practiceTests = tests.filter((t) => t.source === "practice");
  const hasTests = practiceTests.length > 0;
  const hasStudy = study.length > 0;

  const [activeTab, setActiveTab] = useState<"study" | "tests">(hasStudy ? "study" : "tests");

  if (!hasTests && !hasStudy) return null;

  return (
    <div className="pt-3 pb-2">
      {/* Tab bar */}
      <div className="flex border-b border-rusty-border mx-4 mb-3">
        {hasStudy && (
          <button
            onClick={() => setActiveTab("study")}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none
              ${activeTab === "study"
                ? "text-rusty-green border-b-2 border-rusty-green"
                : "text-rusty-muted hover:text-rusty-ink"}`}
          >
            Continue Studying
          </button>
        )}
        {hasTests && (
          <button
            onClick={() => setActiveTab("tests")}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none
              ${activeTab === "tests"
                ? "text-rusty-ai border-b-2 border-rusty-ai"
                : "text-rusty-muted hover:text-rusty-ink"}`}
          >
            Practice Tests
            <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-bold
              ${activeTab === "tests" ? "bg-rusty-ai-soft text-rusty-ai" : "bg-rusty-border text-rusty-muted"}`}>
              {practiceTests.length}
            </span>
          </button>
        )}
      </div>

      {/* Study sessions panel */}
      {activeTab === "study" && hasStudy && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {study.slice(0, 4).map((s, i) => (
            <button
              key={`study-${i}`}
              onClick={() => onContinueStudy(s.subject, s.chapter)}
              className="flex-shrink-0 w-40 bg-rusty-cream border border-rusty-border rounded-xl p-3
                         text-left hover:border-rusty-green focus:outline-none focus:ring-2
                         focus:ring-rusty-green focus:ring-offset-1 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xl">{SUBJECT_EMOJI[s.subject] ?? "📚"}</span>
                <span className="text-[10px] text-rusty-muted">{relativeTime(s.lastAskedAt)}</span>
              </div>
              <p className="text-xs font-semibold text-rusty-ink capitalize leading-tight">
                {s.subject.replace("_", " ")}
              </p>
              {s.chapter && (
                <p className="text-[11px] text-rusty-muted mt-0.5 leading-tight line-clamp-2">{s.chapter}</p>
              )}
              <p className="text-[11px] text-rusty-green mt-1.5 font-medium">Continue →</p>
            </button>
          ))}
        </div>
      )}

      {/* Practice tests panel */}
      {activeTab === "tests" && hasTests && (
        <>
          <div className="flex items-center justify-between px-4 mb-2">
            <span className="text-[10px] bg-rusty-ai-soft text-rusty-ai px-2 py-0.5 rounded-full font-bold tracking-wide">
              ✨ AI Generated
            </span>
            <button
              onClick={onViewAllTests}
              className="text-xs text-rusty-ai font-medium hover:underline focus:outline-none
                         focus:ring-2 focus:ring-rusty-ai rounded px-1 min-h-[32px]"
            >
              View history →
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {practiceTests.slice(0, 4).map((t, i) => {
              const pct = Math.round((t.score / t.total) * 100);
              const isPass = t.score >= Math.ceil(t.total * 0.7);
              return (
                <button
                  key={`test-${i}`}
                  onClick={() => onRetryTest(t.subject, t.chapter)}
                  className="flex-shrink-0 w-40 bg-rusty-cream border border-rusty-ai/30 rounded-xl p-3
                             text-left hover:border-rusty-ai focus:outline-none focus:ring-2
                             focus:ring-rusty-ai focus:ring-offset-1 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{SUBJECT_EMOJI[t.subject] ?? "📚"}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                      ${isPass ? "bg-rusty-success-soft text-rusty-success-dark" : "bg-rusty-warning-soft text-rusty-warning-dark"}`}>
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-rusty-ink capitalize leading-tight">
                    {t.subject.replace("_", " ")}
                  </p>
                  {t.chapter && (
                    <p className="text-[11px] text-rusty-muted mt-0.5 leading-tight line-clamp-1">{t.chapter}</p>
                  )}
                  <p className="text-[11px] text-rusty-ai mt-1.5 font-medium">Retry →</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
