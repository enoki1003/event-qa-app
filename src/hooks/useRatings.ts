import { ref, set } from "firebase/database";
import { db } from "../firebase";

export async function submitRating(roomId: string, sessionId: string, score: number): Promise<void> {
  await set(ref(db, `ratings/${roomId}/${sessionId}`), score);
}
