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
      if (!snapshot.exists()) { setError("ルームが見つかりませんでした。コードを確認してください。"); return; }
      const rooms = snapshot.val();
      const entry = Object.entries(rooms).find(([_, r]: any) => r.code === trimmed);
      if (!entry) { setError("ルームが見つかりませんでした。コードを確認してください。"); return; }
      const room: any = entry[1];
      if (!room.isOpen) { setError("このルームは現在締め切られています。"); return; }
      navigate(`/room/${trimmed}`);
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rimo-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/rimo_logo.svg" alt="Rimo" className="h-7" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-rimo-50 rounded-xl">
            <span className="text-2xl">📷</span>
            <div>
              <p className="text-sm font-medium text-rimo-800">QRコードで参加</p>
              <p className="text-xs text-rimo-600 mt-0.5 leading-relaxed">
                イベント内で案内中のQRコードを<br />
                スマホのカメラで読み取っていただくと<br />
                そのまま入室できます
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs">または</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleJoin}>
            <label className="block text-sm font-medium text-gray-700 mb-2">ルームコードで参加</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase())}
              placeholder="例: ABC123"
              maxLength={8}
              className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rimo-300 focus:border-transparent"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="mt-3 w-full py-3 bg-rimo-500 text-white font-semibold rounded-xl hover:bg-rimo-600 active:bg-rimo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "確認中..." : "参加する"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
