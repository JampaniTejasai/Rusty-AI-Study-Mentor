import { useState } from "react";
import { useAuth } from "./stores/AuthContext";
import { OfflineBanner } from "./components/shared/OfflineBanner";
import { LoginScreen } from "./components/auth/LoginScreen";
import { SubjectSelector } from "./components/auth/SubjectSelector";
import { StudyMode } from "./components/study/StudyMode";
import { TestMode } from "./components/test/TestMode";
import { TakePublishedTest } from "./components/test/TakePublishedTest";
import { QuizPackMode } from "./components/quiz/QuizPackMode";
import { TeacherDashboard } from "./components/teacher/TeacherDashboard";
import { TeacherHome } from "./components/teacher/TeacherHome";
import { CreateTest } from "./components/teacher/CreateTest";
import { AdminHome } from "./components/admin/AdminHome";
import { UserManagement } from "./components/admin/UserManagement";
import { OnboardUser } from "./components/admin/OnboardUser";
import { PdfUpload } from "./components/admin/PdfUpload";
import { RAGDashboard } from "./components/admin/RAGDashboard";
import { RecentActivity } from "./components/student/RecentActivity";
import { AssignedTests } from "./components/student/AssignedTests";
import { InProgressTests } from "./components/student/InProgressTests";
import { AllTests } from "./components/student/AllTests";
import { MyProgress } from "./components/student/MyProgress";
import { getRecentTests, getRecentStudy } from "./stores/recentActivity";
import type { Subject, Mode, PublishedQuiz } from "./types";

type Screen =
  | { name: "student-home" }
  | { name: "teacher-home" }
  | { name: "teacher-study"; classNum: number }
  | { name: "admin-home" }
  | { name: "admin-users" }
  | { name: "admin-onboard" }
  | { name: "admin-upload" }
  | { name: "admin-rag" }
  | { name: "study"; subject: Subject; chapter: string | null }
  | { name: "test"; subject: Subject; chapter: string | null }
  | { name: "resume-test"; testId: string; subject: Subject; chapter: string | null }
  | { name: "assigned-test"; quiz: PublishedQuiz }
  | { name: "all-tests" }
  | { name: "my-progress" }
  | { name: "quiz" }
  | { name: "create-test" }
  | { name: "teacher-dashboard" };

export default function App() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [medium, setMedium] = useState<"en" | "hi">(() => {
    try { return (localStorage.getItem("rusty_medium") as "en" | "hi") ?? "en"; }
    catch { return "en"; }
  });

  function toggleMedium() {
    const next = medium === "en" ? "hi" : "en";
    setMedium(next);
    try { localStorage.setItem("rusty_medium", next); } catch {}
  }

  if (!user) return <LoginScreen />;

  const isTeacher = user.role === "teacher" || user.role === "coordinator";
  const isAdmin = user.role === "admin";
  const defaultScreen: Screen = isAdmin
    ? { name: "admin-home" }
    : isTeacher
    ? { name: "teacher-home" }
    : { name: "student-home" };
  const cur = screen ?? defaultScreen;

  function goHome() { setScreen(null); }

  function handleStart(subject: Subject, chapter: string | null, mode: Mode) {
    if (mode === "study") setScreen({ name: "study", subject, chapter });
    else setScreen({ name: "test", subject, chapter });
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  if (cur.name === "admin-home") return (
    <AdminHome
      onUsers={() => setScreen({ name: "admin-users" })}
      onOnboard={() => setScreen({ name: "admin-onboard" })}
      onUpload={() => setScreen({ name: "admin-upload" })}
      onRAG={() => setScreen({ name: "admin-rag" })}
      onLogout={logout}
    />
  );
  if (cur.name === "admin-users")   return <UserManagement onBack={goHome} />;
  if (cur.name === "admin-onboard") return <OnboardUser onBack={goHome} />;
  if (cur.name === "admin-upload")  return <PdfUpload onBack={goHome} />;
  if (cur.name === "admin-rag")    return <RAGDashboard onBack={goHome} />;

  // ── Teacher ────────────────────────────────────────────────────────────
  if (cur.name === "teacher-home") return (
    <TeacherHome
      onCreateTest={() => setScreen({ name: "create-test" })}
      onQuizPack={() => setScreen({ name: "quiz" })}
      onDashboard={() => setScreen({ name: "teacher-dashboard" })}
      onStudy={(cn) => setScreen({ name: "teacher-study", classNum: cn })}
      onLogout={logout}
    />
  );

  if (cur.name === "create-test") return <CreateTest onBack={goHome} />;
  if (cur.name === "quiz") return <QuizPackMode onBack={goHome} />;
  if (cur.name === "teacher-dashboard") return <TeacherDashboard onBack={goHome} />;

  if (cur.name === "teacher-study") {
    const { classNum } = cur;
    const recentTests = getRecentTests(user.studentId);
    const recentStudy = getRecentStudy(user.studentId);
    return (
      <div className="min-h-screen bg-rusty-sand flex flex-col">
        <OfflineBanner />
        <nav className="bg-rusty-green px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-white font-bold text-sm">Rusty</p>
            <p className="text-white/70 text-xs">Teacher · studying as Class {classNum}</p>
          </div>
          <button onClick={goHome}
            className="text-xs text-white/70 hover:text-white px-2 py-1.5 focus:outline-none
                       focus:ring-2 focus:ring-white rounded min-h-[36px]">
            ← Back
          </button>
        </nav>
        <div className="flex-1 overflow-y-auto">
          <RecentActivity
            tests={recentTests}
            study={recentStudy}
            onContinueStudy={(s, ch) => setScreen({ name: "study", subject: s, chapter: ch })}
            onRetryTest={(s, ch) => setScreen({ name: "test", subject: s, chapter: ch })}
            onViewAllTests={() => setScreen({ name: "all-tests" })}
          />
          <SubjectSelector onStart={handleStart} classNumOverride={classNum} />
        </div>
      </div>
    );
  }

  // ── Shared study/test screens ──────────────────────────────────────────
  if (cur.name === "study") return (
    <StudyMode subject={cur.subject} chapter={cur.chapter} medium={medium} onBack={goHome} />
  );

  if (cur.name === "test") {
    const { subject, chapter } = cur;
    return (
      <TestMode
        subject={subject}
        chapter={chapter}
        medium={medium}
        onBack={goHome}
        onTryAgain={() => setScreen({ name: "test", subject, chapter })}
        onStudyWeakTopics={(s, ch) => setScreen({ name: "study", subject: s, chapter: ch })}
      />
    );
  }

  if (cur.name === "resume-test") {
    const { testId, subject, chapter } = cur;
    return (
      <TestMode
        key={testId}
        subject={subject}
        chapter={chapter}
        medium={medium}
        resumeTestId={testId}
        onBack={goHome}
        onTryAgain={() => setScreen({ name: "test", subject, chapter })}
        onStudyWeakTopics={(s, ch) => setScreen({ name: "study", subject: s, chapter: ch })}
      />
    );
  }

  if (cur.name === "assigned-test") return (
    <TakePublishedTest
      quiz={cur.quiz}
      onBack={goHome}
      onStudyWeakTopics={(s, ch) => setScreen({ name: "study", subject: s, chapter: ch })}
    />
  );

  if (cur.name === "all-tests") return (
    <AllTests
      onBack={goHome}
      onTakeAssigned={(quiz) => setScreen({ name: "assigned-test", quiz })}
      onRetryPractice={(s, ch) => setScreen({ name: "test", subject: s, chapter: ch })}
      onResumePractice={(testId, s, ch) => {
        setScreen({ name: "resume-test", testId, subject: s, chapter: ch });
      }}
    />
  );

  if (cur.name === "my-progress") return <MyProgress onBack={goHome} />;

  // ── Student home ───────────────────────────────────────────────────────
  if (cur.name === "student-home") {
    const recentTests = getRecentTests(user.studentId);
    const recentStudy = getRecentStudy(user.studentId);
    return (
      <div className="min-h-screen bg-rusty-sand flex flex-col">
        <OfflineBanner />
        <nav className="bg-rusty-green px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-white font-bold text-sm">Rusty</p>
            <p className="text-white/70 text-xs">Class {user.classNum} · Bihar Board</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleMedium}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-white/40
                         text-white hover:bg-white/20 transition-colors min-h-[36px]"
              aria-label={`Switch to ${medium === "en" ? "Hindi" : "English"} medium`}>
              {medium === "en" ? "EN" : "हि"}
            </button>
            <button onClick={logout}
              className="text-xs text-white/70 hover:text-white px-2 py-1.5 focus:outline-none
                         focus:ring-2 focus:ring-white rounded min-h-[36px]">
              Logout
            </button>
          </div>
        </nav>
        <div className="flex-1 overflow-y-auto">
          {/* My Progress button */}
          <div className="px-4 pt-4">
            <button
              onClick={() => setScreen({ name: "my-progress" })}
              className="w-full flex items-center gap-3 p-3.5 bg-rusty-cream border border-rusty-border
                         rounded-xl text-left hover:border-rusty-green focus:outline-none
                         focus:ring-2 focus:ring-rusty-green focus:ring-offset-2 transition-colors"
            >
              <div className="w-11 h-11 bg-rusty-ai-soft rounded-xl flex items-center justify-center
                             flex-shrink-0 text-xl">
                📊
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rusty-ink">My Progress</p>
                <p className="text-xs text-rusty-muted">See your scores, streaks &amp; weak topics</p>
              </div>
              <span className="text-rusty-muted text-sm flex-shrink-0">→</span>
            </button>
          </div>
          {/* Assigned tests first — highest priority (teacher-set deadlines) */}
          <AssignedTests
            onTakeTest={(quiz) => setScreen({ name: "assigned-test", quiz })}
            onViewAll={() => setScreen({ name: "all-tests" })}
          />
          {/* In-progress tests — resume where you left off */}
          <InProgressTests
            onResume={(testId, s, ch) => setScreen({ name: "resume-test", testId, subject: s, chapter: ch })}
            onDiscard={() => {}}
          />
          {/* Recent activity — continue where you left off */}
          <RecentActivity
            tests={recentTests}
            study={recentStudy}
            onContinueStudy={(s, ch) => setScreen({ name: "study", subject: s, chapter: ch })}
            onRetryTest={(s, ch) => setScreen({ name: "test", subject: s, chapter: ch })}
            onViewAllTests={() => setScreen({ name: "all-tests" })}
          />
          {/* Study selector */}
          <SubjectSelector onStart={handleStart} />
        </div>
      </div>
    );
  }

  return null;
}
