import { useState } from "react";
import { useNavigate } from "react-router-dom";

const HOST_PASSWORD = import.meta.env.VITE_HOST_PASSWORD || "admin";

export function setHostAuth() {
  sessionStorage.setItem("host_auth", "1");
}
export function isHostAuth() {
  return sessionStorage.getItem("host_auth") === "1";
}

export default function HostLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === HOST_PASSWORD) {
      setHostAuth();
      navigate("/host/dashboard");
    } else {
      setError("パスワードが正しくありません");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/rimo_logo.svg" alt="Rimo" className="h-7" />
        </div>
        <p className="text-center text-sm text-gray-500 mb-4">主催者ログイン</p>
        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rimo-500/30 focus:border-rimo-500"
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={!password}
            className="mt-4 w-full py-3 bg-rimo-500 text-white font-semibold rounded-full hover:bg-rimo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ログイン
          </button>
        </form>
        <p className="text-center mt-6 text-xs text-gray-400">
          <a href="/" className="hover:text-gray-600">← 参加者ページへ</a>
        </p>
      </div>
    </div>
  );
}
