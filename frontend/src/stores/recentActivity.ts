import type { Subject, RecentTestEntry, RecentStudyEntry } from "../types";

const MAX = 10;

function key(userId: string, type: "tests" | "study" | "taken_quizzes") {
  return `rusty:${userId}:recent_${type}`;
}

export function getRecentTests(userId: string): RecentTestEntry[] {
  try { return JSON.parse(localStorage.getItem(key(userId, "tests")) ?? "[]"); }
  catch { return []; }
}

export function addRecentTest(
  userId: string,
  entry: Omit<RecentTestEntry, "completedAt">,
) {
  const existing = getRecentTests(userId);
  const filtered = entry.source === "assigned" && entry.quiz_id
    ? existing.filter((t) => t.quiz_id !== entry.quiz_id)
    : existing.filter((t) => !(t.subject === entry.subject && t.chapter === entry.chapter && t.source === "practice"));
  const updated = [
    { ...entry, completedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX);
  localStorage.setItem(key(userId, "tests"), JSON.stringify(updated));
}

export function getRecentStudy(userId: string): RecentStudyEntry[] {
  try { return JSON.parse(localStorage.getItem(key(userId, "study")) ?? "[]"); }
  catch { return []; }
}

export function addRecentStudy(
  userId: string,
  entry: { subject: Subject; chapter: string | null },
) {
  const existing = getRecentStudy(userId).filter(
    (s) => !(s.subject === entry.subject && s.chapter === entry.chapter),
  );
  const updated = [
    { ...entry, lastAskedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX);
  localStorage.setItem(key(userId, "study"), JSON.stringify(updated));
}

export function getTakenQuizIds(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(key(userId, "taken_quizzes")) ?? "[]"); }
  catch { return []; }
}

export function markQuizTaken(userId: string, quizId: string) {
  const existing = getTakenQuizIds(userId);
  if (!existing.includes(quizId)) {
    localStorage.setItem(key(userId, "taken_quizzes"), JSON.stringify([quizId, ...existing].slice(0, 200)));
  }
}
