import { useState, useEffect, useCallback } from "react";
import { chaptersApi } from "../api";
import { useAuth } from "./AuthContext";

type SubjectChapters = Record<string, string[]>;

const _cache = new Map<number, SubjectChapters>();

export function useChapters(classNumOverride?: number) {
  const { user } = useAuth();
  const classNum = classNumOverride ?? user?.classNum ?? 8;
  const [subjects, setSubjects] = useState<SubjectChapters>(_cache.get(classNum) ?? {});
  const [loading, setLoading] = useState(!_cache.has(classNum));

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await chaptersApi.list(user.firebaseToken, classNum);
      _cache.set(classNum, res.subjects);
      setSubjects(res.subjects);
    } catch {
      // Keep whatever we had
    } finally {
      setLoading(false);
    }
  }, [user, classNum]);

  useEffect(() => {
    const cached = _cache.get(classNum);
    if (cached) {
      setSubjects(cached);
      setLoading(false);
      return;
    }
    refresh();
  }, [classNum, refresh]);

  const getChapters = useCallback(
    (subject: string): string[] => subjects[subject] ?? [],
    [subjects],
  );

  const getSubjects = useCallback(
    (): string[] => Object.keys(subjects),
    [subjects],
  );

  return { subjects, getChapters, getSubjects, loading, refresh };
}
