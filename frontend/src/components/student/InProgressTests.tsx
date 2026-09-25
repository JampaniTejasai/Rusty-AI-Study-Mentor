import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { testApi } from "../../api";
import type { MyTestEntry, Subject } from "../../types";

const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: "📐", science: "🔬", hindi: "अ", social_science: "🌍", english: "📖",
};

interface Props {
  onResume: (testId: string, subject: Subject, chapter: string | null) => void;
  onDiscard: () => void;
}

export function InProgressTests({ onResume, onDiscard }: Props) {
  const { user } = useAuth();
  const [tests, setTests] = useState<MyTestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [discarding, setDiscarding] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    testApi
      .myTests(user.firebaseToken)
      .then((res) => setTests(res.tests.filter((t) => t.status === "in_progress")))
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDiscard(testId: string) {
    if (!user) return;
    setDiscarding(testId);
    try {
      await testApi.deleteTest(testId, user.firebaseToken);
      setTests((prev) => prev.filter((t) => t.test_id !== testId));
    } catch {
      // ignore
    } finally {
      setDiscarding(null);
    }
  }

  if (loading || tests.length === 0) return null;

  return (
    <div className="px-4 pt-4 pb-2">
      <p className="text-xs font-semibold text-rusty-ink uppercase tracking-wide mb-2">
        Continue your test
      </p>
      <div className="space-y-2">
        {tests.map((t) => (
          <div
            key={t.test_id}
            className="flex items-center gap-3 p-3 bg-rusty-warning-soft border border-rusty-warning/30 rounded-xl"
          >
            <button
              onClick={() => onResume(t.test_id, t.subject as Subject, t.chapter)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none"
            >
              <div className="w-10 h-10 bg-rusty-cream rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                {SUBJECT_EMOJI[t.subject] ?? "📚"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rusty-ink capitalize truncate">
                  {t.subject.replace("_", " ")} Test
                </p>
                <p className="text-xs text-rusty-muted">
                  {t.questions_answered}/{t.total} answered
                </p>
              </div>
              <span className="text-xs font-semibold text-rusty-warning-dark bg-white/60 px-2.5 py-1 rounded-full flex-shrink-0">
                Continue
              </span>
            </button>
            <button
              onClick={() => handleDiscard(t.test_id)}
              disabled={discarding === t.test_id}
              className="text-xs text-rusty-muted hover:text-rusty-danger px-1.5 py-1 rounded
                         focus:outline-none focus:ring-2 focus:ring-rusty-danger/50 transition-colors
                         min-w-[32px] min-h-[32px] flex items-center justify-center flex-shrink-0
                         disabled:opacity-40"
              aria-label="Discard test"
            >
              {discarding === t.test_id ? "..." : "Discard"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
