import { useState } from "react";
import { useAuth } from "../../stores/AuthContext";
import { MathRenderer } from "../shared/MathRenderer";
import { addRecentTest, markQuizTaken } from "../../stores/recentActivity";
import type { PublishedQuiz } from "../../types";

type Phase = "question" | "feedback" | "result";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

interface Props {
  quiz: PublishedQuiz;
  onBack: () => void;
  onStudyWeakTopics: (subject: import("../../types").Subject, chapter: string | null) => void;
}

export function TakePublishedTest({ quiz, onBack, onStudyWeakTopics }: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("question");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrongTopics, setWrongTopics] = useState<string[]>([]);
  const [rightTopics, setRightTopics] = useState<string[]>([]);
  const [resultSaved, setResultSaved] = useState(false);

  const q = quiz.mcqs[currentIdx];
  const total = quiz.mcqs.length;
  const progress = total > 0 ? (currentIdx / total) * 100 : 0;
  const pct = Math.round((score / total) * 100);
  const isPass = score >= Math.ceil(total * 0.7);

  function handleAnswer(letter: string) {
    if (phase !== "question") return;
    const isCorrect = letter === q.answer;
    setSelectedOption(letter);
    setPhase("feedback");
    const topic = quiz.chapter ?? quiz.subject.replace("_", " ");
    if (isCorrect) {
      setScore((s) => s + 1);
      setRightTopics((r) => r.includes(topic) ? r : [...r, topic]);
    } else {
      setWrongTopics((w) => w.includes(topic) ? w : [...w, topic]);
    }
  }

  function handleNext() {
    if (currentIdx < total - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setPhase("question");
    } else {
      setPhase("result");
      // Save to recent activity (once)
      if (!resultSaved && user) {
        const finalScore = score + (selectedOption === q.answer ? 0 : 0); // already updated in state
        addRecentTest(user.studentId, {
          subject: quiz.subject,
          chapter: quiz.chapter,
          score: score + (wrongTopics.length === 0 && rightTopics.includes(quiz.chapter ?? quiz.subject.replace("_", " ")) ? 0 : 0),
          total,
          source: "assigned",
          quiz_id: quiz.quiz_id,
          title: quiz.title,
        });
        markQuizTaken(user.studentId, quiz.quiz_id);
        setResultSaved(true);
      }
    }
  }

  // Save result when entering result phase
  function enterResult() {
    setPhase("result");
    if (!resultSaved && user) {
      addRecentTest(user.studentId, {
        subject: quiz.subject,
        chapter: quiz.chapter,
        score,
        total,
        source: "assigned",
        quiz_id: quiz.quiz_id,
        title: quiz.title,
      });
      markQuizTaken(user.studentId, quiz.quiz_id);
      setResultSaved(true);
    }
  }

  function restart() {
    setCurrentIdx(0);
    setSelectedOption(null);
    setScore(0);
    setWrongTopics([]);
    setRightTopics([]);
    setResultSaved(false);
    setPhase("question");
  }

  const subjectLabel = quiz.subject.replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-green text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Back"
          className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                     rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">←</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{quiz.title}</p>
            <span className="text-[10px] bg-white/20 text-white rounded px-1.5 py-0.5 font-bold flex-shrink-0">Assigned</span>
          </div>
          {phase !== "result" && (
            <p className="text-white/70 text-xs">Question {currentIdx + 1} of {total}</p>
          )}
        </div>
        {phase !== "result" && (
          <span className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 flex-shrink-0">
            {score}/{currentIdx + (phase === "feedback" ? 1 : 0)}
          </span>
        )}
      </header>

      {phase !== "result" && (
        <div className="h-1 bg-rusty-green-soft">
          <div className="h-full bg-rusty-green transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 px-4 py-6">
        {(phase === "question" || phase === "feedback") && q && (
          <div className="space-y-4">
            <div className="bg-rusty-cream border border-rusty-border rounded-2xl p-4">
              <p className="text-xs text-rusty-muted mb-1.5">Q{q.question_no}.</p>
              <p className="text-rusty-ink font-medium text-base leading-snug">
                <MathRenderer text={q.question} />
              </p>
            </div>

            <div className="space-y-3">
              {OPTION_LETTERS.map((letter) => {
                const text = q.options[letter];
                if (!text) return null;
                const isSelected = selectedOption === letter;
                const isCorrect = q.answer === letter;
                const isWrong = isSelected && !isCorrect;

                let cls = "w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors min-h-[52px] focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2 ";
                if (phase === "feedback") {
                  if (isCorrect) cls += "bg-rusty-success-soft border-rusty-success text-rusty-success-dark";
                  else if (isWrong) cls += "bg-rusty-danger-soft border-rusty-danger text-rusty-danger-dark";
                  else cls += "bg-rusty-cream border-rusty-border text-rusty-muted";
                } else {
                  cls += "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green-dark";
                }

                return (
                  <button key={letter} onClick={() => handleAnswer(letter)}
                    disabled={phase === "feedback"} className={cls}>
                    <span className="font-bold text-sm w-5 flex-shrink-0 mt-0.5">{letter}.</span>
                    <span className="text-sm leading-snug flex-1"><MathRenderer text={text} /></span>
                    {phase === "feedback" && isCorrect && <span className="ml-auto text-rusty-success text-xs font-bold">✓</span>}
                    {phase === "feedback" && isWrong && <span className="ml-auto text-rusty-danger text-xs font-bold">✗</span>}
                  </button>
                );
              })}
            </div>

            {phase === "feedback" && (
              <div className={`rounded-2xl p-4 space-y-3 border
                ${selectedOption === q.answer ? "bg-rusty-success-soft border-rusty-success/30" : "bg-rusty-danger-soft border-rusty-danger/30"}`}>
                <p className={`font-semibold text-sm ${selectedOption === q.answer ? "text-rusty-success-dark" : "text-rusty-danger-dark"}`}>
                  {selectedOption === q.answer ? "✓ Correct!" : `✗ Incorrect — answer is ${q.answer}`}
                </p>
                {q.explanation && (
                  <p className="text-rusty-ink text-sm leading-relaxed"><MathRenderer text={q.explanation} /></p>
                )}
                <button onClick={currentIdx < total - 1 ? handleNext : enterResult}
                  className="w-full py-3 bg-rusty-green text-white font-semibold rounded-xl
                             hover:bg-rusty-green-dark focus:outline-none focus:ring-2 focus:ring-rusty-green
                             focus:ring-offset-2 transition-colors text-sm min-h-[48px]">
                  {currentIdx < total - 1 ? "Next Question →" : "See Results →"}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "result" && (
          <div className="space-y-5 max-w-md mx-auto">
            <div className={`rounded-2xl p-6 text-center border
              ${isPass ? "bg-rusty-success-soft border-rusty-success/20" : "bg-rusty-warning-soft border-rusty-warning/20"}`}>
              <div className="flex justify-center mb-2">
                <span className="text-[11px] bg-white/60 text-rusty-muted px-2.5 py-0.5 rounded-full font-medium">
                  Teacher Assigned · {subjectLabel}
                </span>
              </div>
              <div className="text-5xl font-bold text-rusty-ink mb-1 tracking-tight">{score}/{total}</div>
              <div className={`text-2xl font-bold mb-2 ${isPass ? "text-rusty-success-dark" : "text-rusty-warning-dark"}`}>{pct}%</div>
              <p className="text-sm font-medium text-rusty-muted truncate">{quiz.title}</p>
            </div>

            {rightTopics.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-rusty-ink mb-2 uppercase tracking-wide">Strong</p>
                <div className="flex flex-wrap gap-2">
                  {rightTopics.map((t, i) => (
                    <span key={i} className="bg-rusty-success-soft text-rusty-success-dark text-xs px-3 py-1.5 rounded-full border border-rusty-success/20 font-medium">
                      ✓ {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {wrongTopics.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-rusty-ink mb-2 uppercase tracking-wide">Review these</p>
                <div className="flex flex-wrap gap-2">
                  {wrongTopics.map((t, i) => (
                    <span key={i} className="bg-rusty-warning-soft text-rusty-warning-dark text-xs px-3 py-1.5 rounded-full border border-rusty-warning/20 font-medium">
                      ⚠ {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              {wrongTopics.length > 0 && (
                <button onClick={() => onStudyWeakTopics(quiz.subject, quiz.chapter)}
                  className="w-full py-3.5 bg-rusty-ai text-white font-semibold rounded-xl
                             hover:bg-rusty-ai-dark transition-colors text-sm min-h-[52px]">
                  Study weak topics with Rusty →
                </button>
              )}
              <button onClick={restart}
                className="w-full py-3.5 bg-rusty-green text-white font-semibold rounded-xl
                           hover:bg-rusty-green-dark transition-colors text-sm min-h-[52px]">
                Try Again
              </button>
              <button onClick={onBack}
                className="w-full py-3.5 border border-rusty-border bg-rusty-cream text-rusty-ink
                           font-semibold rounded-xl hover:border-rusty-green transition-colors text-sm min-h-[52px]">
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
