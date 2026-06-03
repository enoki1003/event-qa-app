import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
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
      const snapshot = await get(ref(db, "rooms"));
      if (!snapshot.exists()) {
        setError("ルームが見つかりませんでした。コードを確認してください。");
        return;
      }
      const rooms = snapshot.val();
      const entry = Object.entries(rooms).find(([_, r]: any) => r.code === trimmed);
      if (!entry) {
        setError("ルームが見つかりませんでした。コードを確認してください。");
        return;
      }
      const room: any = entry[1];
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {/* QRコード案内 */}
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
            <span className="text-2xl">📷</span>
            <div>
              <p className="text-sm font-medium text-indigo-900">QRコードで参加</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                スマホのカメラでQRコードを読み取るとそのまま入室できます
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs">または</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* コード入力 */}
          <form onSubmit={handleJoin}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ルームコードで参加
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase())}
              placeholder="例: ABC123"
              maxLength={8}
              className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="mt-3 w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "確認中..." : "参加する"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">
          <a href="/host" className="hover:text-gray-600 transition-colors">
            登壇者はこちら →
          </a>
        </p>
      </div>
    </div>
  );
}
