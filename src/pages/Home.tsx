import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../firebase";

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      const roomsRef = ref(db, "rooms");
      const q = query(roomsRef, orderByChild("code"), equalTo(trimmed));
      const snapshot = await get(q);

      if (!snapshot.exists()) {
        setError("ルームが見つかりませんでした。コードを確認してください。");
        return;
      }

      const rooms = snapshot.val();
      const roomId = Object.keys(rooms)[0];
      const room = rooms[roomId];

      if (!room.isOpen) {
        setError("このルームは現在締め切られています。");
        return;
      }

      navigate(`/room/${trimmed}`);
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💬</div>
          <h1 className="text-2xl font-bold text-gray-900">Q&A</h1>
          <p className="text-gray-500 text-sm mt-1">イベントに参加して質問しよう</p>
        </div>

        <form onSubmit={handleJoin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ルームコード
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="例: ABC123"
            maxLength={8}
            className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent uppercase"
            autoFocus
            autoComplete="off"
          />
          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="mt-4 w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "確認中..." : "参加する"}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-gray-400">
          <a href="/host" className="hover:text-gray-600 transition-colors">
            登壇者はこちら →
          </a>
        </p>
      </div>
    </div>
  );
}
