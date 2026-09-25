export type Role = "student" | "teacher" | "coordinator" | "admin";
// admin is a separate role with its own home screen and routes
export type Mode = "study" | "test" | "quiz";
export type Subject = "mathematics" | "science" | "hindi" | "social_science" | "english";

export interface AuthUser {
  studentId: string;
  role: Role;
  classNum: number | null;
  centreId: string;
  firebaseToken: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SourceRef {
  chapter: string | null;
  page_num: number | null;
  source_pdf: string | null;
}

export interface StudyResponse {
  key_points: string[];
  notes: string;
  misconceptions: string[];
  source_chunks: number;
  has_math: boolean;
  sources: SourceRef[];
}

export interface QuestionOptions {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface TestQuestion {
  question_id: string;
  question_no: number;
  question_text: string;
  options: QuestionOptions;
  has_math: boolean;
}

export interface TestGenerateResponse {
  test_id: string;
  questions: TestQuestion[];
}

export interface TestAnswerResponse {
  is_correct: boolean;
  correct_option: string;
  explanation: string;
  score_so_far: number;
  questions_remaining: number;
}

export interface TestResult {
  score: number;
  total: number;
  weak_topics: string[];
  strong_topics?: string[];
  math_type_breakdown: Record<string, number>;
}

export interface RecentTestEntry {
  subject: Subject;
  chapter: string | null;
  score: number;
  total: number;
  completedAt: string;
  source: "practice" | "assigned";
  quiz_id?: string;
  title?: string;
}

export interface RecentStudyEntry {
  subject: Subject;
  chapter: string | null;
  lastAskedAt: string;
}

export interface PublishedQuiz {
  quiz_id: string;
  class_num: number;
  subject: Subject;
  chapter: string | null;
  title: string;
  published_at: string;
  mcqs: MCQOut[];
}

export interface AdminUserEntry {
  user_id: string;
  role: "student" | "teacher";
  class_num: number | null;
  centre_id: string;
  is_active: boolean;
  is_offboarded: boolean;
  last_accessed_at: string | null;
  inactive_days: number | null;
}

export interface MCQOut {
  question_no: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
}

export interface ShortAnswerOut {
  question_no: number;
  question: string;
  answer: string;
}

export interface QuizResponse {
  mcqs: MCQOut[];
  short_answers: ShortAnswerOut[];
  plain_text: string;
}

export interface TextbookEntry {
  textbook_id: string;
  source_pdf: string;
  original_filename: string;
  class_num: number;
  subject: string;
  chapter: string | null;
  language: string;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  uploaded_at: string | null;
}

export interface MyTestEntry {
  test_id: string;
  title: string;
  subject: string;
  chapter: string | null;
  created_at: string;
  status: "in_progress" | "completed";
  score: number | null;
  total: number;
  questions_answered: number;
  is_ai_generated: boolean;
}

export interface ResumeQuestionOut {
  question_id: string;
  question_no: number;
  question_text: string;
  options: QuestionOptions;
  has_math: boolean;
  student_answer: string | null;
  is_correct: boolean | null;
  correct_option: string | null;
  explanation: string | null;
}

export interface TestResumeResponse {
  test_id: string;
  title: string;
  subject: string;
  chapter: string | null;
  questions: ResumeQuestionOut[];
  current_index: number;
  score_so_far: number;
}

// ── RAG Observability ────────────────────────────────────────

export interface RAGSummary {
  period_days: number;
  total_queries: number;
  avg_total_ms: number;
  avg_embed_ms: number;
  avg_retrieval_ms: number;
  avg_llm_ms: number;
  total_tokens: number;
  avg_tokens_per_query: number;
  error_rate: number;
  empty_rate: number;
  json_fail_rate: number;
  fallback_rate: number;
  avg_vector_hits: number;
  avg_bm25_hits: number;
  avg_rrf_chunks: number;
  avg_vector_top_score: number;
}

export interface RAGSubjectStat {
  subject: string;
  count: number;
  avg_ms: number;
  tokens: number;
  error_rate: number;
  empty_rate: number;
}

export interface RAGTimelinePoint {
  hour: string;
  count: number;
  avg_total_ms: number;
  avg_embed_ms: number;
  avg_retrieval_ms: number;
  avg_llm_ms: number;
}

export interface RAGTraceEntry {
  trace_id: string;
  created_at: string;
  query_text: string;
  mode: string;
  subject: string;
  class_num: number;
  chapter: string;
  medium: string;
  total_ms: number;
  embed_ms: number;
  retrieval_ms: number;
  llm_ms: number;
  llm_model: string;
  llm_total_tokens: number;
  vector_hits: number;
  bm25_hits: number;
  rrf_chunks: number;
  empty_response: boolean;
  error: string | null;
  retrieved_chunks_preview: string[];
  llm_response_preview: string;
}

// ── Eval Framework ──────────────────────────────────────────

export interface EvalRunSummary {
  filename: string;
  dataset: string;
  mode: string;
  timestamp: string;
  total: number;
  passed: number;
}

export interface EvalCaseResult {
  case_id: string;
  question: string;
  category: string;
  passed: boolean;
  retrieval_correct: boolean | null;
  coverage_score: number;
  coverage_pass: boolean | null;
  exact_match_found: boolean | null;
  scope_correct: boolean;
  groundedness: number | null;
  latency_s: number;
  latency_ok: boolean;
  notes_preview: string;
  key_points_count: number;
  chunks_retrieved: number;
  source_chapters: string[];
  error: string | null;
  failures: string[];
}

export interface EvalRunDetail {
  dataset: string;
  mode: string;
  base_url: string;
  timestamp: string;
  total: number;
  passed: number;
  results: EvalCaseResult[];
}

// ── Student Progress ────────────────────────────────────────

export interface ProgressWeakTopic { topic: string; count: number; }
export interface ProgressSubject {
  subject: string; tests_taken: number; average_pct: number;
  score: number; total: number; weak_topics: ProgressWeakTopic[];
}
export interface ProgressTimelineEntry {
  date: string; subject: string; chapter: string;
  score: number; total: number; pct: number; source: string;
}
export interface StudentProgress {
  period_days: number; total_tests: number; overall_pct: number;
  total_score: number; total_possible: number;
  by_subject: ProgressSubject[]; timeline: ProgressTimelineEntry[];
  study_streak_days: number;
}
