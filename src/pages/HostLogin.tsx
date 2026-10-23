import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, HOST_EMAIL_DOMAIN } from "../firebase";
import { isHostUser, useHostAuth } from "../hooks/useHostAuth";

export default function HostLogin() {
  const { user, loading, isHost } = useHostAuth();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isHost) navigate("/host/dashboard", { replace: true });
  }, [isHost, navigate]);

  const handleLogin = async () => {
    setError("");
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: HOST_EMAIL_DOMAIN, prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      if (!isHostUser(result.user)) {
        await signOut(auth);
        setError(`@${HOST_EMAIL_DOMAIN} のGoogleアカウントでログインしてください`);
      }
    } catch {
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/rimo_logo.svg" alt="Rimo" className="h-7" />
        </div>
        <p className="text-center text-sm text-gray-500 mb-4">主催者ログイン</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-600">
            @{HOST_EMAIL_DOMAIN} のGoogleアカウントでログインしてください。
          </p>
          {user && !isHost && (
            <p className="mt-2 text-xs text-gray-400">現在のアカウント: {user.email}</p>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || signingIn}
            className="mt-4 w-full py-3 bg-rimo-500 text-white font-semibold rounded-full hover:bg-rimo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {signingIn ? "ログイン中..." : "Googleでログイン"}
          </button>
        </div>
        <p className="text-center mt-6 text-xs text-gray-400">
          <a href="/" className="hover:text-gray-600">← 参加者ページへ</a>
        </p>
      </div>
    </div>
  );
}
