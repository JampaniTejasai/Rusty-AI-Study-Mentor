import { useState } from "react";
import { useAuth } from "../../stores/AuthContext";
import { quizApi } from "../../api";
import type { Subject, QuizResponse } from "../../types";
import { MathRenderer } from "../shared/MathRenderer";
import { SkeletonCard } from "../shared/SkeletonCard";
import { useChapters } from "../../stores/useChapters";

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: "Mathematics",
  science: "Science",
  hindi: "Hindi",
  social_science: "Social Science",
  english: "English",
};

interface Props {
  onBack: () => void;
}

export function QuizPackMode({ onBack }: Props) {
  const { user } = useAuth();
  const [classNum, setClassNum] = useState<number>(5);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedClass, setPublishedClass] = useState<number | null>(null);

  const { getChapters, getSubjects, loading: chaptersLoading } = useChapters(classNum);
  const availableSubjects = getSubjects();
  const chapters = subject ? getChapters(subject) : [];

  function handleSubject(s: Subject) { setSubject(s); setChapter(null); }
  function handleClassNum(c: number) { setClassNum(c); setSubject(null); setChapter(null); }

  async function handleGenerate() {
    if (!user || !subject) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPublished(false);
    try {
      const res = await quizApi.generate(classNum, subject, chapter, user.firebaseToken);
      setResult(res);
    } catch {
      setError("Could not generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(targetClass: number) {
    if (!result || !user || !subject) return;
    setPublishing(true);
    try {
      const title = chapter
        ? `${subject.replace("_", " ")} · ${chapter}`
        : `Class ${targetClass} ${subject.replace("_", " ")} Quiz`;
      await quizApi.publish(targetClass, subject, chapter, title, result.mcqs, user.firebaseToken);
      setPublished(true);
      setPublishedClass(targetClass);
    } catch {
      setError("Could not publish quiz. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.plain_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-green text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack}
          className="text-white/80 hover:text-white p-1 -ml-1 focus:outline-none focus:ring-2
                     focus:ring-white rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back">←</button>
        <p className="font-semibold text-sm">Quiz Pack Generator</p>
        <span className="ml-auto bg-white/20 text-white text-xs rounded-full px-2.5 py-0.5">Teacher</span>
      </header>

      <div className="flex-1 px-4 py-6 space-y-5">
        {!result && (
          <>
            {/* Class */}
            <div>
              <label className="block text-sm font-medium text-rusty-ink mb-2">Class</label>
              <div className="flex flex-wrap gap-2">
                {[5, 6, 7, 8, 9, 10].map((c) => (
                  <button key={c} onClick={() => handleClassNum(c)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium min-h-[44px] min-w-[48px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2 transition-colors
                      ${classNum === c ? "bg-rusty-green-soft border-rusty-green text-rusty-green-dark" : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-rusty-ink mb-2">Subject</label>
              {chaptersLoading ? (
                <p className="text-sm text-rusty-muted py-2">Loading subjects...</p>
              ) : availableSubjects.length === 0 ? (
                <p className="text-sm text-rusty-muted py-2">No textbooks uploaded for Class {classNum}.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableSubjects.map((s) => (
                    <button key={s} onClick={() => handleSubject(s as Subject)}
                      className={`px-3 py-3 rounded-xl border text-sm text-left transition-colors min-h-[48px] capitalize
                        focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2
                        ${subject === s ? "bg-rusty-green-soft border-rusty-green text-rusty-green-dark font-semibold" : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"}`}>
                      {SUBJECT_LABELS[s] ?? s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chapter browser */}
            {subject && chapters.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-rusty-ink mb-1">
                  Chapter <span className="text-rusty-muted font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setChapter(null)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-1
                      ${chapter === null ? "bg-rusty-green text-white border-rusty-green font-medium" : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-green"}`}>
                    All chapters
                  </button>
                  {chapters.map((ch) => (
                    <button key={ch} onClick={() => setChapter(ch === chapter ? null : ch)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                        focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-1
                        ${chapter === ch ? "bg-rusty-green text-white border-rusty-green font-medium" : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"}`}>
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rusty-danger-soft border border-rusty-danger rounded-xl px-3 py-2 text-sm text-rusty-danger-dark">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3"><SkeletonCard lines={4} /><SkeletonCard lines={2} /></div>
            ) : (
              <button onClick={handleGenerate} disabled={!subject}
                className="w-full py-3 bg-rusty-green text-white font-semibold rounded-xl
                           hover:bg-rusty-green-dark focus:outline-none focus:ring-2 focus:ring-rusty-green
                           focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors text-base min-h-[52px]">
                Generate Quiz Pack
              </button>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-rusty-ink">Quiz Ready</p>
              <button onClick={() => { setResult(null); setError(null); setPublished(false); }}
                className="text-rusty-muted text-sm hover:text-rusty-ink focus:outline-none focus:underline">
                Generate new
              </button>
            </div>

            {/* Publish banner */}
            {published ? (
              <div className="bg-rusty-success-soft border border-rusty-success/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="text-rusty-success">✓</span>
                <p className="text-sm text-rusty-success-dark font-medium">
                  Published to Class {publishedClass} students. They can see it on their home screen now.
                </p>
              </div>
            ) : (
              <div className="bg-rusty-ai-soft border border-rusty-ai/20 rounded-xl px-4 py-3 space-y-2">
                <p className="text-sm text-rusty-ai font-semibold">Publish for students to take?</p>
                <p className="text-xs text-rusty-ai/80">Select the class that should see this test:</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[5, 6, 7, 8, 9, 10].map((c) => (
                    <button key={c} onClick={() => handlePublish(c)} disabled={publishing}
                      className="px-3 py-1.5 rounded-full bg-rusty-ai text-white text-sm font-medium
                                 hover:bg-rusty-ai-dark disabled:opacity-50 transition-colors min-h-[36px]
                                 focus:outline-none focus:ring-2 focus:ring-rusty-ai">
                      {publishing ? "…" : `Class ${c}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MCQs */}
            <div className="space-y-3">
              {result.mcqs.map((mcq) => (
                <div key={mcq.question_no} className="bg-rusty-cream border border-rusty-border rounded-xl p-4">
                  <p className="text-sm font-medium text-rusty-ink mb-2">
                    Q{mcq.question_no}. <MathRenderer text={mcq.question} />
                  </p>
                  {Object.entries(mcq.options).map(([letter, text]) => (
                    <p key={letter} className={`text-xs py-0.5 ${mcq.answer === letter ? "text-rusty-success-dark font-semibold" : "text-rusty-muted"}`}>
                      {letter}. <MathRenderer text={text} />
                      {mcq.answer === letter && " ✓"}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            {/* Short answers */}
            <div className="space-y-3">
              {result.short_answers.map((sa) => (
                <div key={sa.question_no} className="bg-rusty-cream border border-rusty-border rounded-xl p-4">
                  <p className="text-sm font-medium text-rusty-ink mb-1">Short Q{sa.question_no}. {sa.question}</p>
                  <p className="text-xs text-rusty-success-dark">Ans: {sa.answer}</p>
                </div>
              ))}
            </div>

            <button onClick={handleCopy}
              className="w-full py-3 bg-rusty-terracotta text-white font-semibold rounded-xl
                         hover:opacity-90 transition-opacity text-base min-h-[52px]">
              {copied ? "Copied!" : "Copy for WhatsApp / Print"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
