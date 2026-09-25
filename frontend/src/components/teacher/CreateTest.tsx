import { useState } from "react";
import { useAuth } from "../../stores/AuthContext";
import { quizApi } from "../../api";
import { MathRenderer } from "../shared/MathRenderer";
import { SkeletonCard } from "../shared/SkeletonCard";
import { useChapters } from "../../stores/useChapters";
import type { Subject, MCQOut } from "../../types";

type CreationMode = "ai" | "manual";
type AnswerKey = "A" | "B" | "C" | "D";

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: "Mathematics",
  science: "Science",
  hindi: "Hindi",
  social_science: "Social Science",
  english: "English",
};

interface BlankQuestion {
  question: string;
  A: string; B: string; C: string; D: string;
  answer: AnswerKey;
  explanation: string;
}

const BLANK_Q: BlankQuestion = { question: "", A: "", B: "", C: "", D: "", answer: "A", explanation: "" };

function toMCQOut(q: BlankQuestion, i: number): MCQOut {
  return {
    question_no: i + 1,
    question: q.question,
    options: { A: q.A, B: q.B, C: q.C, D: q.D },
    answer: q.answer,
    explanation: q.explanation,
  };
}

interface Props { onBack: () => void }

export function CreateTest({ onBack }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<CreationMode>("ai");
  const [classNum, setClassNum] = useState(5);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);

  // AI mode state
  const [aiMcqs, setAiMcqs] = useState<MCQOut[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editingAiIdx, setEditingAiIdx] = useState<number | null>(null);
  const [aiEditDraft, setAiEditDraft] = useState<BlankQuestion>({ ...BLANK_Q });

  // Manual mode state
  const [manualQuestions, setManualQuestions] = useState<BlankQuestion[]>([]);
  const [draft, setDraft] = useState<BlankQuestion>({ ...BLANK_Q });
  const [draftError, setDraftError] = useState<string | null>(null);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishedClass, setPublishedClass] = useState<number | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [pickingPublishClass, setPickingPublishClass] = useState(false);

  const { getChapters, getSubjects, loading: chaptersLoading } = useChapters(classNum);
  const availableSubjects = getSubjects();
  const chapters = subject ? getChapters(subject) : [];
  const mcqsToPublish = mode === "ai" ? (aiMcqs ?? []) : manualQuestions.map(toMCQOut);
  const canPublish = mcqsToPublish.length > 0 && !!subject;

  function handleSubject(s: Subject) { setSubject(s); setChapter(null); setAiMcqs(null); setEditingAiIdx(null); }
  function handleClass(c: number) { setClassNum(c); setSubject(null); setChapter(null); setAiMcqs(null); setEditingAiIdx(null); }

  function startEditAi(idx: number) {
    if (!aiMcqs) return;
    const mcq = aiMcqs[idx];
    setAiEditDraft({
      question: mcq.question,
      A: mcq.options.A, B: mcq.options.B, C: mcq.options.C, D: mcq.options.D,
      answer: mcq.answer as AnswerKey,
      explanation: mcq.explanation ?? "",
    });
    setEditingAiIdx(idx);
  }

  function saveAiEdit() {
    if (editingAiIdx === null || !aiMcqs) return;
    const updated = aiMcqs.map((mcq, i) =>
      i === editingAiIdx
        ? { ...mcq, question: aiEditDraft.question, options: { A: aiEditDraft.A, B: aiEditDraft.B, C: aiEditDraft.C, D: aiEditDraft.D }, answer: aiEditDraft.answer, explanation: aiEditDraft.explanation }
        : mcq
    );
    setAiMcqs(updated);
    setEditingAiIdx(null);
  }

  async function handleAiGenerate() {
    if (!user || !subject) return;
    setGenerating(true);
    setAiError(null);
    setAiMcqs(null);
    try {
      const res = await quizApi.generate(classNum, subject, chapter, user.firebaseToken);
      setAiMcqs(res.mcqs);
    } catch {
      setAiError("Could not generate questions. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleAddQuestion() {
    if (!draft.question.trim() || !draft.A.trim() || !draft.B.trim() || !draft.C.trim() || !draft.D.trim()) {
      setDraftError("Please fill in the question and all 4 options.");
      return;
    }
    setManualQuestions((prev) => [...prev, { ...draft }]);
    setDraft({ ...BLANK_Q });
    setDraftError(null);
  }

  function handleRemoveQuestion(idx: number) {
    setManualQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePublish(targetClass: number) {
    if (!user || !subject || mcqsToPublish.length === 0) return;
    setPublishing(true);
    setPublishError(null);
    setPickingPublishClass(false);
    try {
      const title = chapter
        ? `${subject.replace("_", " ")} · ${chapter}`
        : `Class ${targetClass} ${subject.replace("_", " ")} Test`;
      await quizApi.publish(targetClass, subject, chapter, title, mcqsToPublish, user.firebaseToken);
      setPublishedClass(targetClass);
    } catch {
      setPublishError("Could not publish. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-green text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Back"
          className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                     rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">←</button>
        <p className="font-semibold text-sm flex-1">Create Test</p>
        <span className="bg-white/20 text-white text-xs rounded-full px-2.5 py-0.5">Teacher</span>
      </header>

      {/* Mode toggle */}
      <div className="flex border-b border-rusty-border bg-rusty-cream sticky top-[52px] z-10">
        {(["ai", "manual"] as CreationMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-3 text-sm font-medium transition-colors focus:outline-none
              ${mode === m ? "text-rusty-green border-b-2 border-rusty-green" : "text-rusty-muted hover:text-rusty-ink"}`}>
            {m === "ai" ? "✨ AI Generate" : "✏️ Manual"}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-5 space-y-5">
        {/* Shared: Class + Subject + Chapter */}
        {!publishedClass && (
          <>
            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">Class</p>
              <div className="flex flex-wrap gap-2">
                {[5, 6, 7, 8, 9, 10].map((c) => (
                  <button key={c} onClick={() => handleClass(c)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium min-h-[44px] min-w-[48px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2 transition-colors
                      ${classNum === c ? "bg-rusty-green-soft border-rusty-green text-rusty-green-dark" : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">Subject</p>
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

            {subject && chapters.length > 0 && (
              <div>
                <p className="text-sm font-medium text-rusty-ink mb-1">Chapter <span className="text-rusty-muted font-normal">(optional)</span></p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setChapter(null)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                      ${chapter === null ? "bg-rusty-green text-white border-rusty-green font-medium" : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-green"}`}>
                    All chapters
                  </button>
                  {chapters.map((ch) => (
                    <button key={ch} onClick={() => setChapter(ch === chapter ? null : ch)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                        ${chapter === ch ? "bg-rusty-green text-white border-rusty-green font-medium" : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"}`}>
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── AI Generate mode ── */}
        {mode === "ai" && !publishedClass && (
          <>
            {aiError && (
              <div className="bg-rusty-danger-soft border border-rusty-danger rounded-xl px-3 py-2 text-sm text-rusty-danger-dark">{aiError}</div>
            )}
            {generating ? (
              <div className="space-y-3"><SkeletonCard lines={4} /><SkeletonCard lines={2} /></div>
            ) : !aiMcqs ? (
              <button onClick={handleAiGenerate} disabled={!subject}
                className="w-full py-3.5 bg-rusty-ai text-white font-semibold rounded-xl
                           hover:bg-rusty-ai-dark focus:outline-none focus:ring-2 focus:ring-rusty-ai
                           focus:ring-offset-2 disabled:opacity-40 transition-colors text-sm min-h-[52px]">
                ✨ Generate Questions with AI
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-rusty-ink text-sm">{aiMcqs.length} Questions Generated</p>
                  <button onClick={() => { setAiMcqs(null); setEditingAiIdx(null); }}
                    className="text-rusty-muted text-xs hover:text-rusty-ink focus:outline-none focus:underline min-h-[36px]">
                    Regenerate
                  </button>
                </div>
                {aiMcqs.map((mcq, idx) => (
                  <div key={mcq.question_no}>
                    {editingAiIdx === idx ? (
                      /* Inline edit form */
                      <div className="bg-rusty-cream border-2 border-rusty-green rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-rusty-green uppercase tracking-wide">Editing Q{mcq.question_no}</p>
                          <button onClick={() => setEditingAiIdx(null)}
                            className="text-rusty-muted text-xs hover:text-rusty-ink focus:outline-none min-h-[32px]">
                            Cancel
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-rusty-ink mb-1">Question</label>
                          <textarea value={aiEditDraft.question}
                            onChange={(e) => setAiEditDraft({ ...aiEditDraft, question: e.target.value })}
                            rows={2} maxLength={500}
                            className="w-full px-3 py-2 border border-rusty-border rounded-xl text-rusty-ink bg-white
                                       text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rusty-green" />
                        </div>
                        {(["A", "B", "C", "D"] as AnswerKey[]).map((letter) => (
                          <div key={letter}>
                            <label className="block text-xs font-medium text-rusty-ink mb-1">Option {letter}</label>
                            <input type="text" value={aiEditDraft[letter]}
                              onChange={(e) => setAiEditDraft({ ...aiEditDraft, [letter]: e.target.value })}
                              maxLength={200}
                              className="w-full px-3 py-2 border border-rusty-border rounded-xl text-rusty-ink bg-white
                                         text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-rusty-green" />
                          </div>
                        ))}
                        <div>
                          <p className="text-xs font-medium text-rusty-ink mb-1.5">Correct answer</p>
                          <div className="flex gap-2">
                            {(["A", "B", "C", "D"] as AnswerKey[]).map((letter) => (
                              <button key={letter} onClick={() => setAiEditDraft({ ...aiEditDraft, answer: letter })}
                                className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors min-h-[40px]
                                  focus:outline-none focus:ring-2 focus:ring-rusty-green
                                  ${aiEditDraft.answer === letter ? "bg-rusty-success text-white border-rusty-success" : "bg-rusty-cream border-rusty-border text-rusty-muted"}`}>
                                {letter}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-rusty-ink mb-1">Explanation <span className="text-rusty-muted font-normal">(optional)</span></label>
                          <textarea value={aiEditDraft.explanation}
                            onChange={(e) => setAiEditDraft({ ...aiEditDraft, explanation: e.target.value })}
                            rows={2} maxLength={400}
                            className="w-full px-3 py-2 border border-rusty-border rounded-xl text-rusty-ink bg-white
                                       text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rusty-green" />
                        </div>
                        <button onClick={saveAiEdit}
                          className="w-full py-2.5 bg-rusty-green text-white font-semibold rounded-xl
                                     hover:bg-rusty-green-dark text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-rusty-green">
                          Save Changes
                        </button>
                      </div>
                    ) : (
                      /* Read-only preview */
                      <div className="bg-rusty-cream border border-rusty-border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-rusty-ink flex-1">Q{mcq.question_no}. <MathRenderer text={mcq.question} /></p>
                          <button onClick={() => startEditAi(idx)}
                            className="text-rusty-ai text-xs font-medium hover:underline flex-shrink-0 min-h-[32px] min-w-[36px] focus:outline-none">
                            Edit
                          </button>
                        </div>
                        {Object.entries(mcq.options).map(([letter, text]) => (
                          <p key={letter} className={`text-xs py-0.5 ${mcq.answer === letter ? "text-rusty-success-dark font-semibold" : "text-rusty-muted"}`}>
                            {letter}. <MathRenderer text={text} />{mcq.answer === letter && " ✓"}
                          </p>
                        ))}
                        {mcq.explanation && (
                          <p className="text-[11px] text-rusty-muted mt-2 pt-2 border-t border-rusty-border">
                            Reason: {mcq.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Manual mode ── */}
        {mode === "manual" && !publishedClass && (
          <div className="space-y-5">
            {/* Added questions list */}
            {manualQuestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-rusty-ink uppercase tracking-wide">
                  {manualQuestions.length} Question{manualQuestions.length !== 1 ? "s" : ""} Added
                </p>
                {manualQuestions.map((q, i) => (
                  <div key={i} className="bg-rusty-cream border border-rusty-border rounded-xl p-3 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-rusty-ink">Q{i + 1}. {q.question}</p>
                      <p className="text-[11px] text-rusty-success-dark mt-0.5">
                        Answer: {q.answer} — {q[q.answer]}
                      </p>
                    </div>
                    <button onClick={() => handleRemoveQuestion(i)}
                      className="text-rusty-danger text-xs hover:text-rusty-danger-dark flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center focus:outline-none rounded">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add question form */}
            <div className="bg-rusty-cream border border-rusty-border rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-rusty-ink">Add Question</p>

              <div>
                <label className="block text-xs font-medium text-rusty-ink mb-1">Question text</label>
                <textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  placeholder="Enter the question…" rows={2} maxLength={500}
                  className="w-full px-3 py-2.5 border border-rusty-border rounded-xl text-rusty-ink bg-white
                             placeholder:text-rusty-muted focus:outline-none focus:ring-2 focus:ring-rusty-green text-sm resize-none" />
              </div>

              {(["A", "B", "C", "D"] as AnswerKey[]).map((letter) => (
                <div key={letter}>
                  <label className="block text-xs font-medium text-rusty-ink mb-1">Option {letter}</label>
                  <input type="text" value={draft[letter]} onChange={(e) => setDraft({ ...draft, [letter]: e.target.value })}
                    placeholder={`Option ${letter}…`} maxLength={200}
                    className="w-full px-3 py-2.5 border border-rusty-border rounded-xl text-rusty-ink bg-white
                               placeholder:text-rusty-muted focus:outline-none focus:ring-2 focus:ring-rusty-green text-sm min-h-[44px]" />
                </div>
              ))}

              <div>
                <p className="text-xs font-medium text-rusty-ink mb-1.5">Correct answer</p>
                <div className="flex gap-2">
                  {(["A", "B", "C", "D"] as AnswerKey[]).map((letter) => (
                    <button key={letter} onClick={() => setDraft({ ...draft, answer: letter })}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors min-h-[44px]
                        focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-1
                        ${draft.answer === letter ? "bg-rusty-success text-white border-rusty-success" : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-green"}`}>
                      {letter}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-rusty-ink mb-1">Explanation <span className="text-rusty-muted font-normal">(optional)</span></label>
                <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                  placeholder="Why is this the correct answer?" rows={2} maxLength={400}
                  className="w-full px-3 py-2.5 border border-rusty-border rounded-xl text-rusty-ink bg-white
                             placeholder:text-rusty-muted focus:outline-none focus:ring-2 focus:ring-rusty-green text-sm resize-none" />
              </div>

              {draftError && <p className="text-xs text-rusty-danger">{draftError}</p>}

              <button onClick={handleAddQuestion}
                className="w-full py-3 bg-rusty-green text-white font-semibold rounded-xl
                           hover:bg-rusty-green-dark focus:outline-none focus:ring-2 focus:ring-rusty-green
                           focus:ring-offset-2 transition-colors text-sm min-h-[48px]">
                + Add Question
              </button>
            </div>
          </div>
        )}

        {/* ── Publish section ── */}
        {!publishedClass && canPublish && (
          <div className="pt-2 space-y-3">
            {publishError && (
              <div className="bg-rusty-danger-soft border border-rusty-danger rounded-xl px-3 py-2 text-sm text-rusty-danger-dark">{publishError}</div>
            )}

            {!pickingPublishClass ? (
              <button onClick={() => setPickingPublishClass(true)} disabled={publishing}
                className="w-full py-3.5 bg-rusty-terracotta text-white font-semibold rounded-xl
                           hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                           focus:ring-offset-2 disabled:opacity-40 transition-opacity text-sm min-h-[52px]">
                {publishing ? "Publishing…" : `Publish Test (${mcqsToPublish.length} questions) →`}
              </button>
            ) : (
              <div className="bg-rusty-terracotta/10 border border-rusty-terracotta/30 rounded-xl px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-rusty-terracotta">Publish to which class?</p>
                <div className="flex flex-wrap gap-2">
                  {[5, 6, 7, 8, 9, 10].map((c) => (
                    <button key={c} onClick={() => handlePublish(c)} disabled={publishing}
                      className="px-3 py-1.5 rounded-full bg-rusty-terracotta text-white text-sm font-medium
                                 hover:bg-rusty-terracotta-dark disabled:opacity-50 transition-colors min-h-[36px]
                                 focus:outline-none focus:ring-2 focus:ring-rusty-terracotta">
                      {publishing ? "…" : `Class ${c}`}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPickingPublishClass(false)}
                  className="text-xs text-rusty-muted hover:text-rusty-ink focus:outline-none focus:underline min-h-[32px]">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Success ── */}
        {publishedClass && (
          <div className="space-y-4">
            <div className="bg-rusty-success-soft border border-rusty-success/20 rounded-2xl p-5 text-center space-y-2">
              <p className="text-2xl">✅</p>
              <p className="font-bold text-rusty-success-dark">Published!</p>
              <p className="text-sm text-rusty-success-dark">
                Class {publishedClass} students can now see this test on their home screen.
              </p>
              <p className="text-xs text-rusty-muted">{mcqsToPublish.length} questions · {subject?.replace("_", " ")}{chapter ? ` · ${chapter}` : ""}</p>
            </div>
            <button onClick={() => { setPublishedClass(null); setAiMcqs(null); setManualQuestions([]); setPickingPublishClass(false); }}
              className="w-full py-3.5 bg-rusty-green text-white font-semibold rounded-xl
                         hover:bg-rusty-green-dark transition-colors text-sm min-h-[52px]">
              Create Another Test
            </button>
            <button onClick={onBack}
              className="w-full py-3.5 border border-rusty-border bg-rusty-cream text-rusty-ink
                         font-semibold rounded-xl hover:border-rusty-green transition-colors text-sm min-h-[52px]">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
