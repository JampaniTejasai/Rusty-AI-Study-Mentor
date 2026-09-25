import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { adminApi } from "../../api";

interface Props { onBack: () => void }

export function OnboardUser({ onBack }: Props) {
  const { user } = useAuth();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [userId, setUserId] = useState("");
  const [userIdEdited, setUserIdEdited] = useState(false);
  const [classNum, setClassNum] = useState<number>(8);
  const [centreId, setCentreId] = useState("centre-001");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tempPin, setTempPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState(false);

  const ID_RE = /^KHEL-\d{4}-[A-Z0-9]{2,6}$/;
  const isValid = ID_RE.test(userId.trim()) && centreId.trim().length > 0;

  // Auto-populate user ID when role changes (unless admin edited it)
  useEffect(() => {
    if (userIdEdited) return;
    if (!user) return;
    setLoadingId(true);
    adminApi
      .nextUserId(role, user.firebaseToken)
      .then((res) => setUserId(res.next_id))
      .catch(() => setUserId(""))
      .finally(() => setLoadingId(false));
  }, [role]);

  async function handleSubmit() {
    if (!isValid || !user) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await adminApi.onboard(
        { user_id: userId.trim(), role, class_num: role === "student" ? classNum : undefined, centre_id: centreId.trim() },
        user.firebaseToken,
      );
      setTempPin(res.temp_pin);
      setStatus("success");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Onboarding failed. Try again.");
      setStatus("error");
    }
  }

  function reset() {
    setUserIdEdited(false);
    setTempPin(null);
    setStatus("idle");
    setError(null);
    // userId + role will re-trigger useEffect to fetch next ID
  }

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-terracotta text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Back"
          className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                     rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">←</button>
        <p className="font-semibold text-sm">Onboard New User</p>
      </header>

      <div className="flex-1 px-4 py-6 space-y-5">
        {status === "success" && tempPin ? (
          <div className="space-y-5">
            <div className="bg-rusty-success-soft border border-rusty-success/20 rounded-2xl p-6 text-center space-y-3">
              <p className="text-rusty-success-dark font-bold text-base">User created!</p>
              <p className="text-rusty-muted text-sm">{userId}</p>
              <div className="bg-white rounded-xl p-4">
                <p className="text-xs text-rusty-muted mb-1">Temporary PIN — share with user now</p>
                <p className="text-4xl font-bold tracking-[0.4em] text-rusty-ink">{tempPin}</p>
                <p className="text-xs text-rusty-muted mt-2">User will be prompted to change on first login.</p>
              </div>
            </div>
            <button onClick={reset}
              className="w-full py-3.5 bg-rusty-terracotta text-white font-semibold rounded-xl
                         hover:opacity-90 transition-opacity text-sm min-h-[52px]">
              Onboard Another User
            </button>
            <button onClick={onBack}
              className="w-full py-3.5 border border-rusty-border bg-rusty-cream text-rusty-ink
                         font-semibold rounded-xl hover:border-rusty-terracotta transition-colors text-sm min-h-[52px]">
              Back to Admin
            </button>
          </div>
        ) : (
          <>
            {/* Role */}
            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">Role</p>
              <div className="flex gap-3">
                {(["student", "teacher"] as const).map((r) => (
                  <button key={r} onClick={() => { setRole(r); setUserIdEdited(false); }}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium capitalize transition-colors min-h-[48px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-terracotta focus:ring-offset-2
                      ${role === r ? "bg-rusty-terracotta text-white border-rusty-terracotta" : "bg-rusty-cream border-rusty-border text-rusty-ink"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* User ID — auto-populated, editable */}
            <div>
              <label className="block text-sm font-medium text-rusty-ink mb-1">
                User ID
                <span className="text-rusty-muted font-normal ml-1">(auto-generated, editable)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={loadingId ? "Loading…" : "KHEL-2026-042"}
                  value={userId}
                  onChange={(e) => { setUserId(e.target.value.toUpperCase().slice(0, 20)); setUserIdEdited(true); }}
                  maxLength={20}
                  disabled={loadingId}
                  className="w-full px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink bg-rusty-cream
                             placeholder:text-rusty-muted focus:outline-none focus:ring-2
                             focus:ring-rusty-terracotta focus:border-rusty-terracotta text-base min-h-[48px]
                             disabled:opacity-60"
                />
                {loadingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="flex gap-1">
                      {[0,1,2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 bg-rusty-muted rounded-full"
                          style={{ animation: `bounce-dot 1.2s ease-in-out infinite`, animationDelay: `${i*0.2}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {userId.length > 0 && !ID_RE.test(userId) && !loadingId && (
                <p className="text-xs text-rusty-danger mt-1">Format: KHEL-2026-001 or KHEL-2026-T01</p>
              )}
              {userIdEdited && (
                <button
                  onClick={() => { setUserIdEdited(false); }}
                  className="text-xs text-rusty-ai hover:underline mt-1 focus:outline-none min-h-[28px]"
                >
                  ↺ Reset to auto-generated
                </button>
              )}
            </div>

            {/* Class (students only) */}
            {role === "student" && (
              <div>
                <p className="text-sm font-medium text-rusty-ink mb-2">Class</p>
                <div className="flex flex-wrap gap-2">
                  {[5, 6, 7, 8, 9, 10].map((c) => (
                    <button key={c} onClick={() => setClassNum(c)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium min-h-[44px] min-w-[48px]
                        focus:outline-none focus:ring-2 focus:ring-rusty-terracotta focus:ring-offset-2 transition-colors
                        ${classNum === c ? "bg-rusty-terracotta text-white border-rusty-terracotta" : "bg-rusty-cream border-rusty-border text-rusty-ink"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Centre */}
            <div>
              <label className="block text-sm font-medium text-rusty-ink mb-1">Centre ID</label>
              <input type="text" value={centreId}
                onChange={(e) => setCentreId(e.target.value.slice(0, 30))}
                className="w-full px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink bg-rusty-cream
                           focus:outline-none focus:ring-2 focus:ring-rusty-terracotta text-base min-h-[48px]" />
            </div>

            {error && (
              <div className="bg-rusty-danger-soft border border-rusty-danger rounded-xl px-3 py-2 text-sm text-rusty-danger-dark">
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={!isValid || status === "loading" || loadingId}
              className="w-full py-3.5 bg-rusty-terracotta text-white font-semibold rounded-xl
                         hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                         focus:ring-offset-2 disabled:opacity-40 transition-opacity text-sm min-h-[52px]">
              {status === "loading" ? "Creating…" : "Create User & Generate PIN"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
