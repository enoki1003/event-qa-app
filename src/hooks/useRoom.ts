import { useState, useEffect } from "react";
import { ref, onValue, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../firebase";
import type { Room } from "../types";

export function useRoomByCode(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const roomsRef = ref(db, "rooms");
    const q = query(roomsRef, orderByChild("code"), equalTo(code.toUpperCase()));

    const unsub = onValue(q, (snapshot) => {
      setLoading(false);
      if (!snapshot.exists()) {
        setError("ルームが見つかりません");
        return;
      }
      const data = snapshot.val();
      const id = Object.keys(data)[0];
      setRoom({ id, ...data[id] });
    }, () => {
      setLoading(false);
      setError("読み込みに失敗しました");
    });

    return unsub;
  }, [code]);

  return { room, loading, error };
}

export function useRoomById(roomId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snapshot) => {
      setLoading(false);
      if (snapshot.exists()) {
        setRoom({ id: roomId, ...snapshot.val() });
      }
    });

    return unsub;
  }, [roomId]);

  return { room, loading };
}
