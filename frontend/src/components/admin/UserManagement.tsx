import { useState, useEffect } from "react";
import { useAuth } from "../../stores/AuthContext";
import { adminApi } from "../../api";
import type { AdminUserEntry } from "../../types";

// ─── Activity badge ───────────────────────────────────────────────────────────

function ActivityBadge({ lastAccessed, inactiveDays }: { lastAccessed: string | null; inactiveDays: number | null }) {
  if (!lastAccessed) {
    return <span className="text-[11px] bg-rusty-border text-rusty-muted px-2 py-0.5 rounded-full">Never</span>;
  }

  const diff = Date.now() - new Date(lastAccessed).getTime();
  const mins = Math.floor(diff / 60000);
  let label: string;
  if (mins < 60) label = `${Math.max(1, mins)}m ago`;
  else if (mins < 1440) label = `${Math.floor(mins / 60)}h ago`;
  else label = `${inactiveDays}d ago`;

  const isVeryInactive = (inactiveDays ?? 0) > 30;
  const isInactive = (inactiveDays ?? 0) > 14;

  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium
      ${isVeryInactive
        ? "bg-rusty-danger-soft text-rusty-danger-dark"
        : isInactive
        ? "bg-rusty-warning-soft text-rusty-warning-dark"
        : "bg-rusty-success-soft text-rusty-success-dark"}`}>
      {label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ role, muted }: { role: string; muted?: boolean }) {
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0
      ${muted ? "bg-rusty-muted" : role === "teacher" ? "bg-rusty-ai" : "bg-rusty-green"}`}>
      {role === "teacher" ? "T" : "S"}
    </div>
  );
}

// ─── User action modal ────────────────────────────────────────────────────────

type ModalStep = "actions" | "pin" | "offboard-confirm" | "offboard-done";

function UserActionModal({
  target,
  onClose,
  onOffboarded,
}: {
  target: AdminUserEntry;
  onClose: () => void;
  onOffboarded: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<ModalStep>("actions");

  // PIN reset state
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pinStatus, setPinStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const isValidPin = /^\d{4,6}$/.test(pin) && pin === confirm;

  // Offboard state
  const [offboardStatus, setOffboardStatus] = useState<"idle" | "loading" | "error">("idle");

  async function submitPin() {
    if (!isValidPin || !user) return;
    setPinStatus("loading");
    try {
      await adminApi.resetPin(target.user_id, pin, user.firebaseToken);
      setPinStatus("success");
    } catch { setPinStatus("error"); }
  }

  async function confirmOffboard() {
    if (!user) return;
    setOffboardStatus("loading");
    try {
      await adminApi.offboard(target.user_id, user.firebaseToken);
      onOffboarded(target.user_id);
      setStep("offboard-done");
    } catch {
      setOffboardStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-rusty-ink/50 backdrop-blur-sm px-4 pb-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-rusty-cream border border-rusty-border rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-rusty-border">
          <Avatar role={target.role} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-rusty-ink text-sm truncate">{target.user_id}</p>
            <p className="text-rusty-muted text-xs capitalize">
              {target.role}{target.class_num ? ` · Class ${target.class_num}` : ""} · {target.centre_id}
            </p>
          </div>
          <button onClick={onClose}
            className="text-rusty-muted hover:text-rusty-ink focus:outline-none min-w-[32px] min-h-[32px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Step: action picker */}
        {step === "actions" && (
          <div className="p-5 space-y-3">
            <button
              onClick={() => setStep("pin")}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-rusty-border
                         rounded-xl text-left hover:border-rusty-green focus:outline-none focus:ring-2
                         focus:ring-rusty-green transition-colors min-h-[56px]"
            >
              <span className="text-lg">🔑</span>
              <div>
                <p className="text-sm font-semibold text-rusty-ink">Reset PIN</p>
                <p className="text-xs text-rusty-muted">Set a new 4–6 digit PIN for this user</p>
              </div>
            </button>
            <button
              onClick={() => setStep("offboard-confirm")}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-rusty-danger/40
                         rounded-xl text-left hover:border-rusty-danger focus:outline-none focus:ring-2
                         focus:ring-rusty-danger transition-colors min-h-[56px]"
            >
              <span className="text-lg">🚪</span>
              <div>
                <p className="text-sm font-semibold text-rusty-danger">Offboard user</p>
                <p className="text-xs text-rusty-muted">Revoke access — ID and PIN will stop working</p>
              </div>
            </button>
            <button onClick={onClose}
              className="w-full py-2.5 text-rusty-muted text-sm focus:outline-none hover:text-rusty-ink min-h-[40px]">
              Cancel
            </button>
          </div>
        )}

        {/* Step: PIN reset */}
        {step === "pin" && (
          <div className="p-5 space-y-4">
            {pinStatus === "success" ? (
              <div className="space-y-3">
                <div className="bg-rusty-success-soft rounded-xl p-4 text-center">
                  <p className="text-rusty-success-dark font-semibold text-sm">PIN reset successfully.</p>
                </div>
                <button onClick={onClose}
                  className="w-full py-3 bg-rusty-green text-white font-semibold rounded-xl min-h-[48px]">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {["New PIN (4–6 digits)", "Confirm PIN"].map((label, i) => (
                    <div key={i}>
                      <label className="block text-xs font-medium text-rusty-ink mb-1">{label}</label>
                      <input type="password" inputMode="numeric" maxLength={6} placeholder="••••"
                        value={i === 0 ? pin : confirm}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          i === 0 ? setPin(v) : setConfirm(v);
                        }}
                        className="w-full px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink
                                   bg-white tracking-widest text-base min-h-[48px] focus:outline-none
                                   focus:ring-2 focus:ring-rusty-green" />
                    </div>
                  ))}
                  {pinStatus === "error" && <p className="text-xs text-rusty-danger">Reset failed. Try again.</p>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep("actions")}
                    className="flex-1 py-3 border border-rusty-border rounded-xl text-rusty-muted text-sm min-h-[48px]">
                    Back
                  </button>
                  <button onClick={submitPin} disabled={!isValidPin || pinStatus === "loading"}
                    className="flex-1 py-3 bg-rusty-green text-white font-semibold rounded-xl
                               disabled:opacity-40 text-sm min-h-[48px]">
                    {pinStatus === "loading" ? "Saving…" : "Reset PIN"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: offboard confirm */}
        {step === "offboard-confirm" && (
          <div className="p-5 space-y-4">
            <div className="bg-rusty-danger-soft border border-rusty-danger/30 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-rusty-danger">Offboard {target.user_id}?</p>
              <p className="text-xs text-rusty-muted leading-snug">
                Their ID and PIN will be immediately deactivated. They will not be able to log in.
                The account will remain visible in the Offboarded section for records.
              </p>
            </div>
            {offboardStatus === "error" && (
              <p className="text-xs text-rusty-danger">Action failed. Please try again.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep("actions")}
                className="flex-1 py-3 border border-rusty-border rounded-xl text-rusty-muted text-sm min-h-[48px]">
                Cancel
              </button>
              <button onClick={confirmOffboard} disabled={offboardStatus === "loading"}
                className="flex-1 py-3 bg-rusty-danger text-white font-semibold rounded-xl
                           disabled:opacity-40 text-sm min-h-[48px]">
                {offboardStatus === "loading" ? "Offboarding…" : "Yes, Offboard"}
              </button>
            </div>
          </div>
        )}

        {/* Step: offboard done */}
        {step === "offboard-done" && (
          <div className="p-5 space-y-3">
            <div className="bg-rusty-success-soft rounded-xl p-4 text-center space-y-1">
              <p className="text-2xl">🚪</p>
              <p className="text-rusty-success-dark font-semibold text-sm">{target.user_id} offboarded.</p>
              <p className="text-xs text-rusty-muted">Access revoked. Visible in Offboarded section.</p>
            </div>
            <button onClick={onClose}
              className="w-full py-3 bg-rusty-green text-white font-semibold rounded-xl min-h-[48px]">
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Unique centres helper ────────────────────────────────────────────────────

function getCentres(users: AdminUserEntry[]): string[] {
  return [...new Set(users.map((u) => u.centre_id))].sort();
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { onBack: () => void }

export function UserManagement({ onBack }: Props) {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<AdminUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "teacher">("all");
  const [centreFilter, setCentreFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<number | "all">("all");
  const [actionTarget, setActionTarget] = useState<AdminUserEntry | null>(null);
  const [offboardedOpen, setOffboardedOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    adminApi
      .listUsers(user.firebaseToken)
      .then((res) => setAllUsers(res.users))
      .catch(() => setAllUsers([]))
      .finally(() => setLoading(false));
  }, []);

  function handleOffboarded(userId: string) {
    setAllUsers((prev) =>
      prev.map((u) => u.user_id === userId ? { ...u, is_offboarded: true, is_active: false } : u)
    );
  }

  const activeUsers = allUsers.filter((u) => !u.is_offboarded);
  const offboardedUsers = allUsers.filter((u) => u.is_offboarded);
  const centres = getCentres(activeUsers);

  const filtered = activeUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (centreFilter !== "all" && u.centre_id !== centreFilter) return false;
    if (classFilter !== "all" && u.class_num !== classFilter) return false;
    return true;
  });

  const inactiveCount = filtered.filter((u) => (u.inactive_days ?? 0) > 14).length;

  return (
    <>
      <div className="min-h-screen bg-rusty-sand flex flex-col">
        <header className="bg-rusty-terracotta text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={onBack} aria-label="Back"
            className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                       rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">←</button>
          <div className="flex-1">
            <p className="font-semibold text-sm">User Management</p>
            <p className="text-white/70 text-xs">
              {filtered.length} active{inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ""}
              {offboardedUsers.length > 0 ? ` · ${offboardedUsers.length} offboarded` : ""}
            </p>
          </div>
        </header>

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Role filter */}
          <div>
            <p className="text-xs font-medium text-rusty-muted mb-2 uppercase tracking-wide">Role</p>
            <div className="flex gap-2">
              {(["all", "student", "teacher"] as const).map((r) => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px] capitalize
                    focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                    ${roleFilter === r
                      ? "bg-rusty-terracotta text-white border-rusty-terracotta"
                      : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-terracotta"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Centre filter */}
          {centres.length > 1 && (
            <div>
              <p className="text-xs font-medium text-rusty-muted mb-2 uppercase tracking-wide">Centre</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCentreFilter("all")}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                    focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                    ${centreFilter === "all"
                      ? "bg-rusty-terracotta text-white border-rusty-terracotta"
                      : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-terracotta"}`}>
                  All centres
                </button>
                {centres.map((c) => (
                  <button key={c} onClick={() => setCentreFilter(c)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                      ${centreFilter === c
                        ? "bg-rusty-terracotta text-white border-rusty-terracotta"
                        : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-terracotta"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Class filter (students / all) */}
          {roleFilter !== "teacher" && (
            <div>
              <p className="text-xs font-medium text-rusty-muted mb-2 uppercase tracking-wide">Class</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setClassFilter("all")}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px]
                    focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                    ${classFilter === "all"
                      ? "bg-rusty-terracotta text-white border-rusty-terracotta"
                      : "bg-rusty-cream border-rusty-border text-rusty-muted hover:border-rusty-terracotta"}`}>
                  All classes
                </button>
                {[5, 6, 7, 8, 9, 10].map((c) => (
                  <button key={c} onClick={() => setClassFilter(classFilter === c ? "all" : c)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors min-h-[36px] min-w-[44px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                      ${classFilter === c
                        ? "bg-rusty-terracotta text-white border-rusty-terracotta"
                        : "bg-rusty-cream border-rusty-border text-rusty-ink hover:border-rusty-terracotta"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 shimmer-line rounded-xl" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-center text-rusty-muted text-sm py-12">No users found.</p>
          )}

          {/* Active user cards */}
          {!loading && filtered.map((u) => (
            <button key={u.user_id} onClick={() => setActionTarget(u)}
              className="w-full flex items-center gap-3 p-4 bg-rusty-cream border border-rusty-border
                         rounded-xl text-left hover:border-rusty-terracotta focus:outline-none
                         focus:ring-2 focus:ring-rusty-terracotta focus:ring-offset-2 transition-colors">
              <Avatar role={u.role} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rusty-ink truncate">{u.user_id}</p>
                <p className="text-xs text-rusty-muted capitalize">
                  {u.role}{u.class_num ? ` · Class ${u.class_num}` : ""} · {u.centre_id}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <ActivityBadge lastAccessed={u.last_accessed_at} inactiveDays={u.inactive_days} />
                {!u.is_active && (
                  <span className="text-[11px] bg-rusty-warning-soft text-rusty-warning-dark rounded-full px-2 py-0.5">
                    Inactive
                  </span>
                )}
              </div>
            </button>
          ))}

          {/* ── Offboarded section ── */}
          {!loading && offboardedUsers.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setOffboardedOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-rusty-cream
                           border border-rusty-danger/30 rounded-xl text-left focus:outline-none
                           focus:ring-2 focus:ring-rusty-danger transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🚪</span>
                  <p className="text-sm font-semibold text-rusty-danger">
                    Offboarded Users
                  </p>
                  <span className="text-[11px] bg-rusty-danger-soft text-rusty-danger font-bold
                                   px-2 py-0.5 rounded-full">
                    {offboardedUsers.length}
                  </span>
                </div>
                <span className="text-rusty-muted text-xs">{offboardedOpen ? "▲" : "▼"}</span>
              </button>

              {offboardedOpen && (
                <div className="mt-2 space-y-2">
                  {offboardedUsers.map((u) => (
                    <div key={u.user_id}
                      className="flex items-center gap-3 p-4 bg-rusty-cream/60 border border-rusty-border/50
                                 rounded-xl opacity-60">
                      <Avatar role={u.role} muted />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-rusty-muted truncate line-through">{u.user_id}</p>
                        <p className="text-xs text-rusty-muted capitalize">
                          {u.role}{u.class_num ? ` · Class ${u.class_num}` : ""} · {u.centre_id}
                        </p>
                      </div>
                      <span className="text-[11px] bg-rusty-danger-soft text-rusty-danger-dark
                                       font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                        Offboarded
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {actionTarget && (
        <UserActionModal
          target={actionTarget}
          onClose={() => setActionTarget(null)}
          onOffboarded={handleOffboarded}
        />
      )}
    </>
  );
}
