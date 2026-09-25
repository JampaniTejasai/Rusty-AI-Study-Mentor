import { useState } from "react";
import { useAuth } from "../../stores/AuthContext";

interface Props {
  onQuizPack: () => void;
  onCreateTest: () => void;
  onDashboard: () => void;
  onStudy: (classNum: number) => void;
  onLogout: () => void;
}

export function TeacherHome({ onQuizPack, onCreateTest, onDashboard, onStudy, onLogout }: Props) {
  const { user } = useAuth();
  const [pickingClass, setPickingClass] = useState(false);

  const tiles = [
    {
      icon: "✏️",
      title: "Create Test",
      desc: "Build MCQs manually or let AI generate questions. Publish to any class instantly.",
      onClick: onCreateTest,
      accent: "border-rusty-green hover:border-rusty-green",
    },
    {
      icon: "📋",
      title: "AI Quiz Pack",
      desc: "Instantly generate a full MCQ + short-answer pack from Bihar Board content.",
      onClick: onQuizPack,
      accent: "border-rusty-border hover:border-rusty-ai",
    },
    {
      icon: "📚",
      title: "Study & Practice",
      desc: "Use Rusty as a student — study any subject or take a practice test for any class.",
      onClick: () => setPickingClass(true),
      accent: "border-rusty-border hover:border-rusty-green",
    },
    {
      icon: "📊",
      title: "Student Dashboard",
      desc: "View test scores, track weak topics, filter by class and subject. Reset PINs.",
      onClick: onDashboard,
      accent: "border-rusty-border hover:border-rusty-terracotta",
    },
  ];

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-green px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-base">Rusty</p>
            <p className="text-white/70 text-xs mt-0.5">Teacher · {user?.centreId}</p>
          </div>
          <button onClick={onLogout}
            className="text-white/70 hover:text-white text-xs focus:outline-none focus:ring-2
                       focus:ring-white rounded px-2 py-1.5 min-h-[36px]">
            Logout
          </button>
        </div>
        <p className="text-white/90 text-sm mt-3">Welcome back — what would you like to do?</p>
      </header>

      <div className="flex-1 px-4 py-5 space-y-3">
        {tiles.map((t) => (
          <button key={t.title} onClick={t.onClick}
            className={`w-full flex items-center gap-4 p-4 bg-rusty-cream border rounded-2xl
                       text-left focus:outline-none focus:ring-2 focus:ring-rusty-green
                       focus:ring-offset-2 transition-colors min-h-[80px] ${t.accent}`}>
            <div className="w-11 h-11 bg-rusty-green-soft rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-rusty-ink text-sm">{t.title}</p>
              <p className="text-rusty-muted text-xs mt-0.5 leading-snug">{t.desc}</p>
            </div>
            <span className="text-rusty-muted text-lg flex-shrink-0">›</span>
          </button>
        ))}

        <div className="pt-2 border-t border-rusty-border">
          <p className="text-xs text-rusty-muted text-center">
            All content is sourced from Bihar Board textbooks only.
          </p>
        </div>
      </div>

      {/* Class picker overlay */}
      {pickingClass && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                       bg-rusty-ink/50 backdrop-blur-sm px-4 pb-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPickingClass(false); }}>
          <div className="bg-rusty-cream border border-rusty-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div>
              <p className="font-bold text-rusty-ink text-base">Which class?</p>
              <p className="text-rusty-muted text-sm mt-0.5">Select the class you want to study as</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[5, 6, 7, 8, 9, 10].map((c) => (
                <button key={c} onClick={() => { setPickingClass(false); onStudy(c); }}
                  className="py-4 rounded-xl border border-rusty-border bg-rusty-sand text-rusty-ink
                             font-bold text-lg hover:bg-rusty-green-soft hover:border-rusty-green
                             focus:outline-none focus:ring-2 focus:ring-rusty-green transition-colors min-h-[60px]">
                  {c}
                </button>
              ))}
            </div>
            <button onClick={() => setPickingClass(false)}
              className="w-full py-3 border border-rusty-border rounded-xl text-rusty-muted text-sm min-h-[48px]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
