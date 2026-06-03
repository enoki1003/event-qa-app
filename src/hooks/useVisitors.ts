import { useState, useEffect } from "react";
import { ref, get, set, update, onValue, serverTimestamp } from "firebase/database";
import { db } from "../firebase";
import type { Visitor } from "../types";

export function useVisitors(roomId: string) {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const visRef = ref(db, `visitors/${roomId}`);
    const unsub = onValue(visRef, (snapshot) => {
      setLoading(false);
      if (!snapshot.exists()) { setVisitors([]); return; }
      const data = snapshot.val() as Record<string, Omit<Visitor, "sessionId">>;
      const list = Object.entries(data)
        .map(([sessionId, v]) => ({ sessionId, ...v }))
        .sort((a, b) => a.firstAccessAt - b.firstAccessAt);
      setVisitors(list);
    });
    return unsub;
  }, [roomId]);

  return { visitors, loading };
}

export async function recordVisit(roomId: string, sessionId: string) {
  const visRef = ref(db, `visitors/${roomId}/${sessionId}`);
  const snapshot = await get(visRef);
  if (!snapshot.exists()) {
    await set(visRef, {
      firstAccessAt: serverTimestamp(),
      companyName: null,
      authorName: null,
    });
  }
}

export async function updateVisitorInfo(
  roomId: string,
  sessionId: string,
  companyName: string | null,
  authorName: string | null
) {
  const visRef = ref(db, `visitors/${roomId}/${sessionId}`);
  const snapshot = await get(visRef);
  if (snapshot.exists()) {
    await update(visRef, {
      companyName: companyName || snapshot.val().companyName || null,
      authorName: authorName || snapshot.val().authorName || null,
    });
  }
}
