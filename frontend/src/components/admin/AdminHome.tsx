import { useAuth } from "../../stores/AuthContext";

interface Props {
  onUsers: () => void;
  onOnboard: () => void;
  onUpload: () => void;
  onRAG: () => void;
  onLogout: () => void;
}

export function AdminHome({ onUsers, onOnboard, onUpload, onRAG, onLogout }: Props) {
  const { user } = useAuth();

  const tiles = [
    { icon: "👥", title: "User Management", desc: "View students and teachers, reset PINs, deactivate accounts.", onClick: onUsers },
    { icon: "➕", title: "Onboard Users", desc: "Add new students or teachers. System generates a temporary PIN.", onClick: onOnboard },
    { icon: "📄", title: "Upload Textbook", desc: "Upload Bihar Board PDFs for AI ingestion and RAG queries.", onClick: onUpload },
    { icon: "📊", title: "RAG Observatory", desc: "Monitor AI pipeline health, latency, token usage, and retrieval quality.", onClick: onRAG },
  ];

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-terracotta px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-base">Rusty Admin</p>
            <p className="text-white/70 text-xs mt-0.5">{user?.centreId} · Administrator</p>
          </div>
          <button onClick={onLogout}
            className="text-white/70 hover:text-white text-xs px-2 py-1.5 rounded min-h-[36px]
                       focus:outline-none focus:ring-2 focus:ring-white">
            Logout
          </button>
        </div>
        <p className="text-white/90 text-sm mt-3">Administration panel</p>
      </header>

      <div className="flex-1 px-4 py-6 space-y-4">
        {tiles.map((t) => (
          <button key={t.title} onClick={t.onClick}
            className="w-full flex items-center gap-4 p-5 bg-rusty-cream border border-rusty-border
                       rounded-2xl text-left hover:border-rusty-terracotta focus:outline-none
                       focus:ring-2 focus:ring-rusty-terracotta focus:ring-offset-2 transition-colors min-h-[88px]">
            <div className="w-12 h-12 bg-rusty-terracotta-soft rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-rusty-ink text-base">{t.title}</p>
              <p className="text-rusty-muted text-sm mt-0.5">{t.desc}</p>
            </div>
            <span className="text-rusty-muted text-lg flex-shrink-0">›</span>
          </button>
        ))}

        <div className="pt-2 border-t border-rusty-border">
          <p className="text-xs text-rusty-muted text-center">
            All actions are logged. Safeguarding records are never deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
