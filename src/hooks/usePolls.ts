import { ref, push, set, update, remove, onValue, off, serverTimestamp } from "firebase/database";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import type { Poll } from "../types";

export function usePolls(roomId: string) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) { setLoading(false); return; }
    const pollsRef = ref(db, `polls/${roomId}`);
    const unsubscribe = onValue(pollsRef, (snapshot) => {
      const data = snapshot.val();
      const list: Poll[] = data
        ? Object.entries(data).map(([id, p]) => ({ id, ...(p as Omit<Poll, "id">) }))
        : [];
      list.sort((a, b) => a.order - b.order);
      setPolls(list);
      setLoading(false);
    });
    return () => off(pollsRef, "value", unsubscribe);
  }, [roomId]);

  return { polls, loading };
}

export async function createPoll(
  roomId: string,
  title: string,
  options: string[],
  order: number,
  allowMultiple: boolean
): Promise<string> {
  const result = await push(ref(db, `polls/${roomId}`), {
    title,
    options: options.filter((o) => o.trim()),
    status: "draft",
    allowMultiple,
    order,
    createdAt: serverTimestamp(),
    votes: {},
  });
  return result.key!;
}

export async function updatePoll(
  roomId: string,
  pollId: string,
  data: { title: string; options: string[]; allowMultiple: boolean }
) {
  await update(ref(db, `polls/${roomId}/${pollId}`), {
    title: data.title,
    options: data.options.filter((o) => o.trim()),
    allowMultiple: data.allowMultiple,
  });
}

export async function activatePoll(roomId: string, pollId: string) {
  await update(ref(db, `polls/${roomId}/${pollId}`), { status: "active" });
}

export async function closePoll(roomId: string, pollId: string) {
  await update(ref(db, `polls/${roomId}/${pollId}`), { status: "closed" });
}

export async function deletePoll(roomId: string, pollId: string) {
  await remove(ref(db, `polls/${roomId}/${pollId}`));
}

export async function castVote(roomId: string, pollId: string, browserSessionId: string, indices: number[]) {
  await set(ref(db, `polls/${roomId}/${pollId}/votes/${browserSessionId}`), indices);
}
