import { useState, useEffect } from "react";
import { ref, onValue, push, update, remove, serverTimestamp } from "firebase/database";
import { db } from "../firebase";
import type { Room, RoomSettings } from "../types";

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roomsRef = ref(db, "rooms");
    const unsub = onValue(roomsRef, (snapshot) => {
      setLoading(false);
      if (!snapshot.exists()) {
        setRooms([]);
        return;
      }
      const data = snapshot.val() as Record<string, Omit<Room, "id">>;
      const list = Object.entries(data).map(([id, r]) => ({ id, ...r }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setRooms(list);
    });
    return unsub;
  }, []);

  return { rooms, loading };
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createRoom(
  title: string,
  description: string,
  settings: RoomSettings
): Promise<string> {
  const roomsRef = ref(db, "rooms");
  const result = await push(roomsRef, {
    title,
    description,
    code: generateCode(),
    isOpen: true,
    createdAt: serverTimestamp(),
    settings,
  });
  return result.key!;
}

export async function updateRoom(roomId: string, data: Partial<Room>) {
  await update(ref(db, `rooms/${roomId}`), data);
}

export async function deleteRoom(roomId: string) {
  await remove(ref(db, `rooms/${roomId}`));
  await remove(ref(db, `questions/${roomId}`));
}

export async function toggleRoomOpen(roomId: string, isOpen: boolean) {
  await update(ref(db, `rooms/${roomId}`), { isOpen });
}
