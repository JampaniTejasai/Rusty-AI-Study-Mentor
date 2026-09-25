import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { quizApi, testApi } from "../../api";
import { getTakenQuizIds } from "../../stores/recentActivity";
import type { PublishedQuiz, Subject, MyTestEntry } from "../../types";

type Tab = "assigned" | "practice";
type StatusFilter = "all" | "pending" | "taken";

const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: "📐", science: "🔬", hindi: "अ", social_science: "🌍", english: "📖",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

interface Props {
  onBack: () => void;
  onTakeAssigned: (quiz: PublishedQuiz) => void;
  onRetryPractice: (subject: Subject, chapter: string | null) => void;
  onResumePractice: (testId: string, subject: Subject, chapter: string | null) => void;
}

export function AllTests({ onBack, onTakeAssigned, onRetryPractice, onResumePractice }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("assigned");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [quizzes, setQuizzes] = useState<PublishedQuiz[]>([]);
  const [practiceTests, setPracticeTests] = useState<MyTestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [practiceLoading, setPracticeLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); setPracticeLoading(false); return; }
    if (user.classNum) {
      quizApi
        .assigned(user.classNum, user.firebaseToken)
        .then((res) => setQuizzes(res.quizzes))
        .catch(() => setQuizzes([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    testApi
      .myTests(user.firebaseToken)
      .then((res) => setPracticeTests(res.tests))
      .catch(() => setPracticeTests([]))
      .finally(() => setPracticeLoading(false));
  }, []);

  const takenIds = user ? getTakenQuizIds(user.studentId) : [];

  const filteredAssigned = quizzes.filter((q) => {
    const isTaken = takenIds.includes(q.quiz_id);
    if (statusFilter === "pending") return !isTaken;
    if (statusFilter === "taken") return isTaken;
    return true;
  });

  const pendingCount = quizzes.filter((q) => !takenIds.includes(q.quiz_id)).length;
  const inProgressCount = practiceTests.filter((t) => t.status === "in_progress").length;

  async function handleDelete(testId: string) {
    if (!user) return;
    setDeleting(testId);
    try {
      await testApi.deleteTest(testId, user.firebaseToken);
      setPracticeTests((prev) => prev.filter((t) => t.test_id !== testId));
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-green text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Back"
          className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                     rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">←</button>
        <p className="font-semibold text-sm flex-1">My Tests</p>
      </header>

      <div className="flex border-b border-rusty-border bg-rusty-cream sticky top-[52px] z-10">
        {(["assigned", "practice"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors focus:outline-none
              ${tab === t
                ? "text-rusty-green border-b-2 border-rusty-green"
                : "text-rusty-muted hover:text-rusty-ink"}`}
          >
            {t === "assigned"
              ? `Assigned${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}`
              : `Practice${inProgressCount > 0 ? ` (${inProgressCount} in progress)` : ""}`}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {/* ASSIGNED tab */}
        {tab === "assigned" && (
          <>
            <div className="flex gap-2">
              {(["all", "pending", "taken"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium capitalize transition-colors min-h-[36px]
                    focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-1
                    ${statusFilter === f
                      ? "bg-rusty-green text-white border-rusty-green"
                      : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-green"}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 shimmer-line rounded-xl" />
                ))}
              </div>
            )}

            {!loading && filteredAssigned.length === 0 && (
              <div className="text-center py-14">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-rusty-ink font-semibold text-sm">
                  {statusFilter === "pending" ? "All caught up!" : statusFilter === "taken" ? "No tests taken yet" : "No assigned tests"}
                </p>
                <p className="text-rusty-muted text-xs mt-1">
                  {statusFilter === "pending" ? "You've completed all assigned tests." : "Tests assigned by your teacher appear here."}
                </p>
              </div>
            )}

            {!loading && filteredAssigned.map((quiz) => {
              const isTaken = takenIds.includes(quiz.quiz_id);
              return (
                <button
                  key={quiz.quiz_id}
                  onClick={() => onTakeAssigned(quiz)}
                  className="w-full flex items-center gap-3 p-3.5 bg-rusty-cream border border-rusty-border
                             rounded-xl text-left hover:border-rusty-green focus:outline-none
                             focus:ring-2 focus:ring-rusty-green focus:ring-offset-2 transition-colors"
                >
                  <div className="w-11 h-11 bg-rusty-warning-soft rounded-xl flex items-center justify-center
                                 flex-shrink-0 text-xl">
                    {SUBJECT_EMOJI[quiz.subject] ?? "📝"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-rusty-ink truncate">{quiz.title}</p>
                    <p className="text-xs text-rusty-muted capitalize mt-0.5">
                      {quiz.subject.replace("_", " ")}{quiz.chapter ? ` · ${quiz.chapter}` : ""} · {quiz.mcqs.length} Qs
                    </p>
                    <p className="text-[11px] text-rusty-muted mt-0.5">{relativeTime(quiz.published_at)}</p>
                  </div>
                  {isTaken ? (
                    <span className="text-[11px] bg-rusty-success-soft text-rusty-success-dark px-2 py-1 rounded-full font-medium flex-shrink-0">
                      Done
                    </span>
                  ) : (
                    <span className="text-rusty-warning-dark text-xs font-semibold flex-shrink-0">Take</span>
                  )}
                </button>
              );
            })}
          </>
        )}

        {/* PRACTICE tab */}
        {tab === "practice" && (
          <>
            {practiceLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 shimmer-line rounded-xl" />
                ))}
              </div>
            )}

            {!practiceLoading && practiceTests.length === 0 && (
              <div className="text-center py-14">
                <p className="text-3xl mb-3">✨</p>
                <p className="text-rusty-ink font-semibold text-sm">No practice tests yet</p>
                <p className="text-rusty-muted text-xs mt-1">Complete a Practice Test from the home screen to see your history here.</p>
              </div>
            )}

            {!practiceLoading && practiceTests.map((t) => {
              const isInProgress = t.status === "in_progress";
              const pct = t.score != null && t.total > 0 ? Math.round((t.score / t.total) * 100) : null;
              const isPass = pct != null && pct >= 70;
              return (
                <div
                  key={t.test_id}
                  className="flex items-center gap-3 p-3.5 bg-rusty-cream border border-rusty-border rounded-xl"
                >
                  <button
                    onClick={() => isInProgress ? onResumePractice(t.test_id, t.subject as Subject, t.chapter) : onRetryPractice(t.subject as Subject, t.chapter)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl
                      ${isInProgress ? "bg-rusty-warning-soft" : "bg-rusty-ai-soft"}`}>
                      {SUBJECT_EMOJI[t.subject] ?? "📚"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-semibold text-rusty-ink capitalize truncate">
                          {t.subject.replace("_", " ")}
                        </p>
                        <span className="text-[9px] bg-rusty-ai-soft text-rusty-ai px-1.5 py-0.5 rounded font-bold tracking-wide flex-shrink-0">AI</span>
                      </div>
                      {t.chapter && <p className="text-xs text-rusty-muted truncate">{t.chapter}</p>}
                      <p className="text-[11px] text-rusty-muted mt-0.5">
                        {relativeTime(t.created_at)}
                        {isInProgress && ` · ${t.questions_answered}/${t.total} answered`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {isInProgress ? (
                        <span className="text-xs font-semibold text-rusty-warning-dark bg-rusty-warning-soft px-2.5 py-1 rounded-full">
                          Continue
                        </span>
                      ) : (
                        <>
                          <p className={`text-base font-bold ${isPass ? "text-rusty-success-dark" : "text-rusty-warning-dark"}`}>
                            {pct}%
                          </p>
                          <p className="text-[11px] text-rusty-muted">{t.score}/{t.total}</p>
                        </>
                      )}
                    </div>
                  </button>

                  {t.is_ai_generated && (
                    <button
                      onClick={() => handleDelete(t.test_id)}
                      disabled={deleting === t.test_id}
                      aria-label="Delete test"
                      className="text-rusty-muted hover:text-rusty-danger text-sm p-2 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-rusty-danger/50 transition-colors
                                 min-w-[36px] min-h-[36px] flex items-center justify-center flex-shrink-0
                                 disabled:opacity-40"
                    >
                      {deleting === t.test_id ? "..." : "🗑"}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
