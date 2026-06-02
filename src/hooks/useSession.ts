import { useMemo } from "react";

function generateSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useSession(): string {
  return useMemo(() => {
    const key = "qa_session_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = generateSessionId();
      sessionStorage.setItem(key, id);
    }
    return id;
  }, []);
}
