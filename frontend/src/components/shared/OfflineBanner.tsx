import { useState, useEffect } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(() => {
    try {
      return !navigator.onLine;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    function handleOffline() {
      setOffline(true);
    }
    function handleOnline() {
      setOffline(false);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs text-center px-4 py-2 sticky top-0 z-50"
    >
      You're offline. Some features may not work.
    </div>
  );
}
