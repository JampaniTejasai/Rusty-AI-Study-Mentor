import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./stores/AuthContext";
import "./index.css";

function Root() {
  const [ready, setReady] = useState(!import.meta.env.DEV);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import("./mocks/browser").then(({ worker }) =>
      worker.start({
        onUnhandledRequest: "bypass",
        serviceWorker: { url: "/mockServiceWorker.js" },
      })
    ).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-rusty-sand flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-rusty-green rounded-2xl mx-auto flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-rusty-muted text-sm">Starting Rusty…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
