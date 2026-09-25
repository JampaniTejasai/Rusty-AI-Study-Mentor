import { useState, useEffect } from "react";
import type { Subject, Mode } from "../../types";
import { useChapters } from "../../stores/useChapters";

const SUBJECT_META: Record<string, { label: string; emoji: string }> = {
  mathematics: { label: "Mathematics", emoji: "📐" },
  science: { label: "Science", emoji: "🔬" },
  hindi: { label: "Hindi", emoji: "अ" },
  social_science: { label: "Social Science", emoji: "🌍" },
  english: { label: "English", emoji: "📖" },
};

interface Props {
  onStart: (subject: Subject, chapter: string | null, mode: Mode) => void;
  classNumOverride?: number;
}

export function SubjectSelector({ onStart, classNumOverride }: Props) {
  const { getChapters, getSubjects, loading } = useChapters(classNumOverride);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("study");

  const availableSubjects = getSubjects();
  const chapters = subject ? getChapters(subject) : [];

  useEffect(() => {
    if (!loading && availableSubjects.length === 1 && !subject) {
      setSubject(availableSubjects[0] as Subject);
    }
  }, [loading, availableSubjects.length]);

  function handleSubject(s: Subject) {
    setSubject(s);
    setChapter(null);
  }

  function handleStart() {
    if (!subject) return;
    onStart(subject, chapter, mode);
  }

  return (
    <div className="bg-rusty-sand px-4 py-6 pb-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-rusty-ink mb-1">What would you like to study?</h2>
        <p className="text-rusty-muted text-sm mb-4">
          {classNumOverride ? `Class ${classNumOverride}` : ""} Bihar Board
        </p>
        {loading ? (
          <p className="text-sm text-rusty-muted py-4">Loading subjects...</p>
        ) : availableSubjects.length === 0 ? (
          <p className="text-sm text-rusty-muted py-4">No textbooks uploaded yet. Ask your admin to upload textbooks.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {availableSubjects.map((s) => {
              const meta = SUBJECT_META[s] ?? { label: s.replace("_", " "), emoji: "📘" };
              return (
                <button
                  key={s}
                  onClick={() => handleSubject(s as Subject)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors min-h-[64px]
                    focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2
                    ${subject === s
                      ? "bg-rusty-green-soft border-rusty-green text-rusty-green-dark font-semibold"
                      : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"
                    }`}
                >
                  <span className="text-2xl w-8 text-center flex-shrink-0">{meta.emoji}</span>
                  <span className="text-sm font-medium leading-tight capitalize">{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {subject && chapters.length > 0 && (
        <div>
          <p className="text-sm font-medium text-rusty-ink mb-2">
            Chapter <span className="text-rusty-muted font-normal">(optional — tap to filter)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setChapter(null)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-1
                ${chapter === null
                  ? "bg-rusty-green text-white border-rusty-green font-medium"
                  : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-green"
                }`}
            >
              All chapters
            </button>
            {chapters.map((ch) => (
              <button
                key={ch}
                onClick={() => setChapter(ch === chapter ? null : ch)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                  focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-1
                  ${chapter === ch
                    ? "bg-rusty-green text-white border-rusty-green font-medium"
                    : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-green"
                  }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {[
          { value: "study" as Mode, label: "Study Mode", desc: "Ask questions, get textbook answers", icon: "📚" },
          { value: "test" as Mode, label: "Practice Test", desc: "5 MCQs with instant feedback", icon: "✏️" },
        ].map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors
              focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2
              ${mode === m.value
                ? "bg-rusty-green-soft border-rusty-green"
                : "bg-rusty-cream border-rusty-border hover:border-rusty-green"
              }`}
          >
            <span className="text-xl w-7 text-center flex-shrink-0">{m.icon}</span>
            <div className="flex items-center gap-3 flex-1">
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors
                  ${mode === m.value ? "border-rusty-green bg-rusty-green" : "border-rusty-border"}`}
              />
              <div>
                <p className={`text-sm font-semibold ${mode === m.value ? "text-rusty-green-dark" : "text-rusty-ink"}`}>
                  {m.label}
                </p>
                <p className="text-xs text-rusty-muted">{m.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleStart}
        disabled={!subject}
        className="w-full py-3.5 bg-rusty-green text-white font-semibold rounded-xl
                   hover:bg-rusty-green-dark focus:outline-none focus:ring-2 focus:ring-rusty-green focus:ring-offset-2
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-base min-h-[52px]"
      >
        {mode === "study" ? "Start Studying" : "Start Practice Test"}
      </button>
    </div>
  );
}
