import { useState, useEffect } from "react";
import {
  ref,
  onValue,
  push,
  update,
  runTransaction,
  serverTimestamp,
} from "firebase/database";
import { db } from "../firebase";
import type { Question, QuestionInput, RoomSettings } from "../types";

export function useQuestions(roomId: string) {
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const qRef = ref(db, `questions/${roomId}`);
    const unsub = onValue(qRef, (snapshot) => {
      if (!snapshot.exists()) {
        setQuestions([]);
        return;
      }
      const data = snapshot.val() as Record<string, Omit<Question, "id">>;
      const list = Object.entries(data).map(([id, q]) => ({ id, ...q }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setQuestions(list);
    });

    return unsub;
  }, [roomId]);

  return questions;
}

export async function submitQuestion(
  roomId: string,
  input: QuestionInput,
  sessionId: string,
  settings: RoomSettings
) {
  const qRef = ref(db, `questions/${roomId}`);
  await push(qRef, {
    roomId,
    text: input.text.trim(),
    authorName: input.authorName || null,
    likes: 0,
    likedBy: {},
    status: settings.requireApproval ? "pending" : "approved",
    isAnswered: false,
    isHidden: false,
    sessionId,
    createdAt: serverTimestamp(),
  });
}

export async function toggleLike(
  roomId: string,
  questionId: string,
  sessionId: string
) {
  const likeRef = ref(db, `questions/${roomId}/${questionId}/likedBy/${sessionId}`);
  const likesRef = ref(db, `questions/${roomId}/${questionId}/likes`);

  await runTransaction(likeRef, (current) => {
    return current ? null : true;
  }).then(({ snapshot }) => {
    const liked = snapshot.val();
    return runTransaction(likesRef, (count) => Math.max(0, (count || 0) + (liked ? 1 : -1)));
  });
}

export async function approveQuestion(roomId: string, questionId: string) {
  await update(ref(db, `questions/${roomId}/${questionId}`), { status: "approved" });
}

export async function rejectQuestion(roomId: string, questionId: string) {
  await update(ref(db, `questions/${roomId}/${questionId}`), { status: "rejected" });
}

export async function markAnswered(roomId: string, questionId: string, isAnswered: boolean) {
  await update(ref(db, `questions/${roomId}/${questionId}`), { isAnswered });
}

export async function toggleHidden(roomId: string, questionId: string, isHidden: boolean) {
  await update(ref(db, `questions/${roomId}/${questionId}`), { isHidden });
}
