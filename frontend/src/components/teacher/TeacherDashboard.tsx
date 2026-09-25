import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { teacherApi, authApi } from "../../api";
import type { Subject } from "../../types";

interface StudentScore {
  student_id: string;
  display_name: string;
  scores: { score: number; total: number; taken_at: string }[];
  average_score: number;
  weak_topics: string[];
}

interface PinModalState {
  studentId: string;
  displayName: string;
}

function PinResetModal({
  student,
  onClose,
}: {
  student: PinModalState;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isValid = /^\d{4,6}$/.test(pin) && pin === confirm;

  async function handleSubmit() {
    if (!isValid || !user || status === "loading") return;
    setStatus("loading");
    try {
      await authApi.resetPin(student.studentId, pin, user.firebaseToken);
      setStatus("success");
    } catch {
      setErrorMsg("PIN reset failed. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-rusty-ink/50 backdrop-blur-sm px-4 pb-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-rusty-cream border border-rusty-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
        <div>
          <p className="font-bold text-rusty-ink text-base">Reset PIN</p>
          <p className="text-rusty-muted text-sm mt-0.5">{student.displayName}</p>
        </div>

        {status === "success" ? (
          <div className="space-y-4">
            <div className="bg-rusty-success-soft border border-rusty-success/20 rounded-xl p-4 text-center">
              <p className="text-rusty-success-dark font-semibold text-sm">PIN reset successfully.</p>
              <p className="text-rusty-muted text-xs mt-1">Student will be asked to set a new PIN on next login.</p>
            </div>
            <button onClick={onClose}
              className="w-full py-3 bg-rusty-green text-white font-semibold rounded-xl
                         hover:bg-rusty-green-dark transition-colors text-sm min-h-[48px]">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-rusty-ink mb-1">New PIN (4–6 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  maxLength={6}
                  className="w-full px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink bg-white
                             placeholder:text-rusty-muted focus:outline-none focus:ring-2 focus:ring-rusty-green
                             focus:border-rusty-green text-base tracking-widest min-h-[48px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-rusty-ink mb-1">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  maxLength={6}
                  className="w-full px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink bg-white
                             placeholder:text-rusty-muted focus:outline-none focus:ring-2 focus:ring-rusty-green
                             focus:border-rusty-green text-base tracking-widest min-h-[48px]"
                />
              </div>
              {confirm.length > 0 && pin !== confirm && (
                <p className="text-xs text-rusty-danger">PINs do not match.</p>
              )}
              {status === "error" && (
                <p className="text-xs text-rusty-danger">{errorMsg}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 border border-rusty-border rounded-xl text-rusty-muted text-sm
                           hover:border-rusty-green hover:text-rusty-ink transition-colors min-h-[48px]">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid || status === "loading"}
                className="flex-1 py-3 bg-rusty-green text-white font-semibold rounded-xl
                           hover:bg-rusty-green-dark focus:outline-none focus:ring-2 focus:ring-rusty-green
                           focus:ring-offset-2 disabled:opacity-40 transition-colors text-sm min-h-[48px]"
              >
                {status === "loading" ? "Saving…" : "Reset PIN"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  onBack: () => void;
}

export function TeacherDashboard({ onBack }: Props) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState<number>(5);
  const [filterSubject, setFilterSubject] = useState<Subject>("mathematics");
  const [pinModal, setPinModal] = useState<PinModalState | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    teacherApi
      .scores(user.firebaseToken, { class_num: filterClass, subject: filterSubject })
      .then((res) => setStudents(res.students as StudentScore[]))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [filterClass, filterSubject]);

  return (
    <>
      <div className="min-h-screen bg-rusty-sand flex flex-col">
        <header className="bg-rusty-green text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={onBack}
            className="text-white/80 hover:text-white p-1 -ml-1 focus:outline-none focus:ring-2
                       focus:ring-white rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            ←
          </button>
          <p className="font-semibold text-sm">Student Dashboard</p>
          <span className="ml-auto text-xs text-white/60 hidden sm:block">Tap a student to reset PIN</span>
        </header>

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-rusty-border rounded-xl bg-rusty-cream text-rusty-ink
                         text-sm focus:outline-none focus:ring-2 focus:ring-rusty-green min-h-[44px]"
            >
              {[5, 6, 7, 8, 9, 10].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value as Subject)}
              className="flex-1 px-3 py-2 border border-rusty-border rounded-xl bg-rusty-cream text-rusty-ink
                         text-sm focus:outline-none focus:ring-2 focus:ring-rusty-green min-h-[44px]"
            >
              {["mathematics", "science", "hindi", "social_science", "english"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-rusty-cream border border-rusty-border rounded-xl p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-rusty-border rounded w-1/3" />
                  <div className="h-3 bg-rusty-border rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && students.length === 0 && (
            <div className="text-center py-12 text-rusty-muted text-sm">
              No test results yet for this class and subject.
            </div>
          )}

          {!loading && students.map((student) => {
            const avg = student.average_score;
            const isHigh = avg >= 7;
            const isLow = avg < 5;
            const rowBg = isHigh
              ? "bg-rusty-success-soft border-rusty-success/30"
              : isLow
              ? "bg-rusty-warning-soft border-rusty-warning/30"
              : "bg-rusty-cream border-rusty-border";

            return (
              <button
                key={student.student_id}
                onClick={() => setPinModal({ studentId: student.student_id, displayName: student.display_name })}
                className={`w-full border rounded-xl p-4 space-y-2 text-left transition-colors
                  hover:border-rusty-green focus:outline-none focus:ring-2 focus:ring-rusty-green
                  focus:ring-offset-2 ${rowBg}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-rusty-ink text-sm">{student.display_name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0
                    ${isHigh ? "bg-rusty-success text-white" : isLow ? "bg-rusty-warning text-white" : "bg-rusty-border text-rusty-muted"}`}>
                    Avg {avg}/10
                  </span>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {student.scores.slice(-5).map((s, i) => (
                    <span key={i} className="text-xs text-rusty-muted bg-rusty-sand rounded-full px-2 py-0.5">
                      {s.score}/{s.total}
                    </span>
                  ))}
                </div>

                {student.weak_topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {student.weak_topics.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-xs bg-rusty-warning-soft text-rusty-warning-dark rounded-full px-2 py-0.5">
                        {t.slice(0, 28)}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-rusty-muted">Tap to reset PIN →</p>
              </button>
            );
          })}
        </div>
      </div>

      {pinModal && (
        <PinResetModal student={pinModal} onClose={() => setPinModal(null)} />
      )}
    </>
  );
}
