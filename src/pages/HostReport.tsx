import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { isHostAuth } from "./HostLogin";
import { useRoomById } from "../hooks/useRoom";
import { useQuestions } from "../hooks/useQuestions";
import { useVisitors } from "../hooks/useVisitors";
import { usePolls } from "../hooks/usePolls";
import { ReportPanel } from "../components/ReportPanel";
import type { Session } from "../types";

export default function HostReport() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room } = useRoomById(roomId ?? "");
  const questions = useQuestions(roomId ?? "");
  const { visitors, loading: visitorsLoading } = useVisitors(roomId ?? "");
  const { polls } = usePolls(roomId ?? "");

  useEffect(() => {
    if (!isHostAuth()) navigate("/host");
  }, [navigate]);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  const sessions: Session[] = Object.entries(room.sessions || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/host/room/${roomId}`)}
            className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0"
          >
            ← 戻る
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{room.title} — レポート</h1>
            {room.eventDate && (
              <p className="text-xs text-gray-400">
                {new Date(room.eventDate).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {room.eventTime && ` ${room.eventTime}`}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5">
        <ReportPanel
          room={room}
          sessions={sessions}
          questions={questions}
          visitors={visitors}
          visitorsLoading={visitorsLoading}
          polls={polls}
        />
      </div>
    </div>
  );
}
