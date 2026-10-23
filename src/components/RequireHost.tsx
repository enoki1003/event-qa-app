import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useHostAuth } from "../hooks/useHostAuth";

// 認証確定前に子のDB購読が走ると permission_denied で購読が切れるため、確定まで描画しない
export default function RequireHost({ children }: { children: ReactNode }) {
  const { loading, isHost } = useHostAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }
  if (!isHost) return <Navigate to="/host" replace />;
  return <>{children}</>;
}
