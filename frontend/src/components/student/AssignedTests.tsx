import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { quizApi } from "../../api";
import { getTakenQuizIds } from "../../stores/recentActivity";
import type { PublishedQuiz } from "../../types";

const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: "📐", science: "🔬", hindi: "अ", social_science: "🌍", english: "📖",
};

interface Props {
  onTakeTest: (quiz: PublishedQuiz) => void;
  onViewAll: () => void;
}

export function AssignedTests({ onTakeTest, onViewAll }: Props) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<PublishedQuiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.classNum) { setLoading(false); return; }
    quizApi
      .assigned(user.classNum, user.firebaseToken)
      .then((res) => setQuizzes(res.quizzes))
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-2">
        <div className="h-4 shimmer-line rounded w-32 mb-3" />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {[0, 1].map((i) => (
            <div key={i} className="flex-shrink-0 w-44 h-28 bg-rusty-cream border border-rusty-border rounded-xl shimmer-line" />
          ))}
        </div>
      </div>
    );
  }

  if (quizzes.length === 0) return null;

  const takenIds = user ? getTakenQuizIds(user.studentId) : [];
  // Sort newest first (already sorted by API), show top 3
  const preview = quizzes.slice(0, 3);
  const pendingCount = quizzes.filter((q) => !takenIds.includes(q.quiz_id)).length;

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-rusty-ink uppercase tracking-wide">Assigned Tests</p>
          {pendingCount > 0 && (
            <span className="text-[10px] bg-rusty-warning-soft text-rusty-warning-dark px-1.5 py-0.5 rounded-full font-bold">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-rusty-ai font-medium hover:underline focus:outline-none
                     focus:ring-2 focus:ring-rusty-ai rounded px-1 min-h-[32px]"
        >
          See all {quizzes.length} →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {preview.map((quiz) => {
          const isTaken = takenIds.includes(quiz.quiz_id);
          return (
            <button
              key={quiz.quiz_id}
              onClick={() => onTakeTest(quiz)}
              className="flex-shrink-0 w-44 bg-rusty-cream border border-rusty-border rounded-xl p-3
                         text-left hover:border-rusty-warning focus:outline-none focus:ring-2
                         focus:ring-rusty-warning focus:ring-offset-1 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{SUBJECT_EMOJI[quiz.subject] ?? "📝"}</span>
                {isTaken ? (
                  <span className="text-[10px] bg-rusty-success-soft text-rusty-success-dark px-1.5 py-0.5 rounded-full font-bold">
                    ✓ Done
                  </span>
                ) : (
                  <span className="text-[10px] bg-rusty-warning-soft text-rusty-warning-dark px-1.5 py-0.5 rounded-full font-bold">
                    Pending
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-rusty-ink line-clamp-2 leading-tight">{quiz.title}</p>
              <p className="text-[11px] text-rusty-muted mt-1 capitalize">
                {quiz.subject.replace("_", " ")} · {quiz.mcqs.length} Qs
              </p>
              <p className={`text-[11px] mt-1.5 font-medium ${isTaken ? "text-rusty-success-dark" : "text-rusty-warning-dark"}`}>
                {isTaken ? "Retake →" : "Take →"}
              </p>
            </button>
          );
        })}

        {quizzes.length > 3 && (
          <button
            onClick={onViewAll}
            className="flex-shrink-0 w-20 bg-rusty-warning-soft border border-rusty-warning/30
                       rounded-xl flex flex-col items-center justify-center gap-0.5 min-h-[112px]
                       hover:border-rusty-warning focus:outline-none focus:ring-2 focus:ring-rusty-warning transition-colors"
          >
            <p className="text-xl font-bold text-rusty-warning-dark">+{quizzes.length - 3}</p>
            <p className="text-[10px] text-rusty-warning-dark font-medium">more</p>
          </button>
        )}
      </div>
    </div>
  );
}
