import { api } from "./client";
import type {
  StudyResponse, TestGenerateResponse, TestAnswerResponse,
  TestResult, QuizResponse, Subject, PublishedQuiz, AdminUserEntry, MCQOut,
  TextbookEntry, MyTestEntry, TestResumeResponse,
  RAGSummary, RAGSubjectStat, RAGTimelinePoint, RAGTraceEntry,
  EvalRunSummary, EvalRunDetail,
  StudentProgress,
} from "../types";

export const authApi = {
  login: (studentId: string, pin: string) =>
    api.post<{ firebase_token: string; role: string; class_num: number | null; centre_id: string }>(
      "/auth/login",
      { student_id: studentId, pin },
    ),

  resetPin: (studentId: string, newPin: string, token: string) =>
    api.post<{ success: boolean }>("/auth/reset-pin", { student_id: studentId, new_pin: newPin }, token),
};

export type ChaptersAllResponse = { class_num: number; subjects: Record<string, string[]> };

export const chaptersApi = {
  list: (token: string, classNum?: number) => {
    const qs = classNum ? `?class_num=${classNum}` : "";
    return api.get<ChaptersAllResponse>(`/study/chapters${qs}`, token);
  },
};

export interface ChapterSummaryResponse {
  class_num: number;
  subject: string;
  chapter: string;
  language: string;
  summary: string;
  key_topics: string[];
  important_formulas: string[];
  important_definitions: string[];
  chunk_count: number;
}

export const studyApi = {
  query: (
    query: string,
    subject: Subject,
    chapter: string | null,
    history: { role: "user" | "assistant"; content: string }[],
    token: string,
    medium: "en" | "hi" = "en",
  ) =>
    api.post<StudyResponse>("/study/query", { query, subject, chapter, history, medium }, token),

  chapterSummary: (subject: Subject, chapter: string, token: string, medium: "en" | "hi" = "en") =>
    api.get<ChapterSummaryResponse>(
      `/study/summary?subject=${subject}&chapter=${encodeURIComponent(chapter)}&medium=${medium}`,
      token,
    ),
};

export const testApi = {
  generate: (subject: Subject, chapter: string | null, token: string, medium: "en" | "hi" = "en", signal?: AbortSignal) =>
    api.post<TestGenerateResponse>("/test/generate", { subject, chapter, medium }, token, signal),

  answer: (testId: string, questionId: string, answer: string, token: string) =>
    api.post<TestAnswerResponse>("/test/answer", { test_id: testId, question_id: questionId, answer }, token),

  result: (testId: string, token: string) =>
    api.get<TestResult>(`/test/result/${testId}`, token),

  myTests: (token: string) =>
    api.get<{ tests: MyTestEntry[] }>("/test/my-tests", token),

  resume: (testId: string, token: string) =>
    api.get<TestResumeResponse>(`/test/resume/${testId}`, token),

  deleteTest: (testId: string, token: string) =>
    api.delete<{ success: boolean }>(`/test/${testId}`, token),
};

export const quizApi = {
  generate: (classNum: number, subject: Subject, chapter: string | null, token: string) =>
    api.post<QuizResponse>("/quiz/generate", { class_num: classNum, subject, chapter }, token),

  publish: (classNum: number, subject: Subject, chapter: string | null, title: string, mcqs: MCQOut[], token: string) =>
    api.post<{ quiz_id: string }>("/quiz/publish", { class_num: classNum, subject, chapter, title, mcqs }, token),

  assigned: (classNum: number, token: string) =>
    api.get<{ quizzes: PublishedQuiz[] }>(`/quiz/assigned?class_num=${classNum}`, token),
};

export const adminApi = {
  listUsers: (
    token: string,
    params?: { role?: string; class_num?: number; centre_id?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.class_num) qs.set("class_num", String(params.class_num));
    if (params?.centre_id) qs.set("centre_id", params.centre_id);
    return api.get<{ users: AdminUserEntry[] }>(`/admin/users?${qs}`, token);
  },

  nextUserId: (role: "student" | "teacher", token: string) =>
    api.get<{ next_id: string }>(`/admin/next-user-id?role=${role}`, token),

  onboard: (
    data: { user_id: string; role: "student" | "teacher"; class_num?: number; centre_id: string },
    token: string,
  ) =>
    api.post<{ temp_pin: string }>("/admin/onboard", data, token),

  resetPin: (userId: string, newPin: string, token: string) =>
    api.post<{ success: boolean }>("/admin/reset-pin", { user_id: userId, new_pin: newPin }, token),

  offboard: (userId: string, token: string) =>
    api.post<{ success: boolean }>("/admin/offboard", { user_id: userId }, token),

  uploadPdf: (formData: FormData, token: string) =>
    api.postForm<{ textbook_id: string; source_pdf: string; status: string; message: string }>("/admin/upload-pdf", formData, token),

  listTextbooks: (token: string) =>
    api.get<{ textbooks: TextbookEntry[] }>("/admin/textbooks", token),

  deleteTextbook: (textbookId: string, token: string) =>
    api.delete<{ success: boolean; deleted_chunks: number }>(`/admin/textbooks/${textbookId}`, token),
};

export const ragApi = {
  summary: (token: string, days = 7) =>
    api.get<RAGSummary>(`/admin/rag/summary?days=${days}`, token),

  bySubject: (token: string, days = 7) =>
    api.get<{ subjects: RAGSubjectStat[] }>(`/admin/rag/by-subject?days=${days}`, token),

  timeline: (token: string, days = 7) =>
    api.get<{ timeline: RAGTimelinePoint[] }>(`/admin/rag/timeline?days=${days}`, token),

  recent: (token: string, limit = 50) =>
    api.get<{ traces: RAGTraceEntry[] }>(`/admin/rag/recent?limit=${limit}`, token),

  evalRuns: (token: string) =>
    api.get<{ runs: EvalRunSummary[] }>("/admin/eval/runs", token),

  evalRunDetail: (filename: string, token: string) =>
    api.get<EvalRunDetail>(`/admin/eval/run/${encodeURIComponent(filename)}`, token),
};

export const studentApi = {
  progress: (token: string, days = 30) =>
    api.get<StudentProgress>(`/student/progress?days=${days}`, token),
};

export const teacherApi = {
  scores: (token: string, params?: { class_num?: number; subject?: string }) => {
    const qs = new URLSearchParams();
    if (params?.class_num) qs.set("class_num", String(params.class_num));
    if (params?.subject) qs.set("subject", params.subject);
    return api.get<{ students: unknown[] }>(`/teacher/scores?${qs}`, token);
  },

  weakTopics: (classNum: number, subject: string, token: string) =>
    api.get<{ topic_breakdown: unknown[] }>(`/teacher/weak-topics?class_num=${classNum}&subject=${subject}`, token),
};
