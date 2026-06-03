import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { isHostAuth } from "./HostLogin";
import { useRoomById } from "../hooks/useRoom";
import { useQuestions } from "../hooks/useQuestions";
import { useVisitors } from "../hooks/useVisitors";
import type { Session } from "../types";

function exportReportCsv(
  visitors: ReturnType<typeof useVisitors>["visitors"],
  roomTitle: string
) {
  const rows = [
    ["アクセス日時", "会社名", "お名前", "セッションID"],
    ...visitors.map((v) => [
      new Date(v.firstAccessAt).toLocaleString("ja-JP"),
      v.companyName || "",
      v.authorName || "",
      v.sessionId,
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${roomTitle}_report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HostReport() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room } = useRoomById(roomId ?? "");
  const questions = useQuestions(roomId ?? "");
  const { visitors, loading: visitorsLoading } = useVisitors(roomId ?? "");

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

  const totalQuestions = questions.length;
  const approvedQuestions = questions.filter((q) => q.status === "approved").length;
  const answeredQuestions = questions.filter((q) => q.isAnswered).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* ヘッダー */}
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
                {new Date(room.eventDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                {room.eventTime && ` ${room.eventTime}`}
              </p>
            )}
          </div>
          <button
            onClick={() => exportReportCsv(visitors, room.title)}
            className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 flex-shrink-0"
          >
            CSV出力
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-5">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "アクセス人数", value: visitors.length, unit: "人", color: "indigo" },
            { label: "総質問数", value: totalQuestions, unit: "件", color: "gray" },
            { label: "承認済み", value: approvedQuestions, unit: "件", color: "green" },
            { label: "回答済み", value: answeredQuestions, unit: "件", color: "blue" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {item.value}
                <span className="text-sm font-normal text-gray-400 ml-1">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* セッション別質問数 */}
        {sessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">セッション別 質問数</h2>
            <div className="space-y-3">
              {sessions.map((session) => {
                const count = questions.filter((q) => q.sessionId === session.id).length;
                const approved = questions.filter((q) => q.sessionId === session.id && q.status === "approved").length;
                const maxCount = Math.max(...sessions.map((s) => questions.filter((q) => q.sessionId === s.id).length), 1);
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={session.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium truncate max-w-xs">{session.title}</span>
                      <span className="text-gray-500 flex-shrink-0 ml-2">
                        {count}件
                        <span className="text-xs text-gray-400 ml-1">（承認済み {approved}件）</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {/* セッションなし */}
              {(() => {
                const count = questions.filter((q) => !q.sessionId).length;
                if (count === 0) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-400">（セッションなし）</span>
                      <span className="text-gray-400">{count}件</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 参加者一覧 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              参加者一覧
              <span className="text-sm font-normal text-gray-400 ml-2">{visitors.length}人</span>
            </h2>
          </div>

          {visitorsLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">読み込み中...</div>
          ) : visitors.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              まだ参加者がいません
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* ヘッダー行 */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 text-xs text-gray-400 font-medium">
                <div className="col-span-1">#</div>
                <div className="col-span-5">会社名 / お名前</div>
                <div className="col-span-4">初回アクセス日時</div>
                <div className="col-span-2">質問数</div>
              </div>
              {visitors.map((v, i) => {
                const qCount = questions.filter((q) => q.browserSessionId === v.sessionId).length;
                const displayName = [v.companyName, v.authorName].filter(Boolean).join(" / ") || "匿名";
                return (
                  <div key={v.sessionId} className="grid grid-cols-12 gap-2 px-5 py-3 items-center hover:bg-gray-50/50">
                    <div className="col-span-1 text-xs text-gray-400">{i + 1}</div>
                    <div className="col-span-5">
                      <p className="text-sm text-gray-800 truncate">{displayName}</p>
                    </div>
                    <div className="col-span-4">
                      <p className="text-xs text-gray-500">
                        {new Date(v.firstAccessAt).toLocaleString("ja-JP", {
                          month: "numeric", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-xs font-medium ${qCount > 0 ? "text-indigo-600" : "text-gray-300"}`}>
                        {qCount > 0 ? `${qCount}件` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
