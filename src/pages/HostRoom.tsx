import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { isHostAuth } from "./HostLogin";
import { useRoomById } from "../hooks/useRoom";
import { useQuestions, approveQuestion, rejectQuestion, markAnswered, toggleHidden } from "../hooks/useQuestions";
import { toggleRoomOpen } from "../hooks/useRooms";
import type { Question, QuestionStatus } from "../types";

type Filter = "all" | "pending" | "approved" | "answered";

async function notifySlack(webhookUrl: string, question: Question, roomTitle: string) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*[${roomTitle}] 新しい質問が承認されました*\n${question.authorName ? `> *${question.authorName}*\n` : ""}\n> ${question.text}`,
      }),
    });
  } catch {
    // Slack通知失敗はサイレント
  }
}

function exportCsv(questions: Question[], roomTitle: string) {
  const rows = [
    ["ID", "質問", "投稿者", "いいね数", "ステータス", "回答済み", "投稿日時"],
    ...questions.map((q) => [
      q.id,
      `"${q.text.replace(/"/g, '""')}"`,
      q.authorName || "匿名",
      q.likes,
      q.status === "approved" ? "承認" : q.status === "rejected" ? "却下" : "承認待ち",
      q.isAnswered ? "済" : "未",
      new Date(q.createdAt).toLocaleString("ja-JP"),
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${roomTitle}_questions.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room } = useRoomById(roomId ?? "");
  const questions = useQuestions(roomId ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [showQr, setShowQr] = useState(false);

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

  const roomUrl = `${window.location.origin}/room/${room.code}`;

  const filtered = questions.filter((q) => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "approved") return q.status === "approved" && !q.isAnswered;
    if (filter === "answered") return q.isAnswered;
    return true;
  });

  const counts = {
    all: questions.length,
    pending: questions.filter((q) => q.status === "pending").length,
    approved: questions.filter((q) => q.status === "approved" && !q.isAnswered).length,
    answered: questions.filter((q) => q.isAnswered).length,
  };

  const handleApprove = async (q: Question) => {
    await approveQuestion(room.id, q.id);
    if (room.settings.slackWebhookUrl) {
      await notifySlack(room.settings.slackWebhookUrl, q, room.title);
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `全て (${counts.all})` },
    { key: "pending", label: `承認待ち (${counts.pending})` },
    { key: "approved", label: `承認済み (${counts.approved})` },
    { key: "answered", label: `回答済み (${counts.answered})` },
  ];

  const statusBadge = (status: QuestionStatus) => {
    if (status === "approved") return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">承認済み</span>;
    if (status === "rejected") return <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">却下</span>;
    return <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">承認待ち</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/host/dashboard")}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ← 戻る
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{room.title}</h1>
            <p className="text-xs text-gray-400 font-mono">コード: {room.code}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowQr(true)}
              className="px-2 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
              title="QRコード"
            >
              QR
            </button>
            <button
              onClick={() => toggleRoomOpen(room.id, !room.isOpen)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                room.isOpen
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {room.isOpen ? "受付中" : "締切"}
            </button>
            <button
              onClick={() => exportCsv(questions, room.title)}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
            >
              CSV出力
            </button>
          </div>
        </div>
      </div>

      {/* QR modal */}
      {showQr && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <QRCodeSVG value={roomUrl} size={240} />
            <p className="text-sm text-gray-500 font-mono text-center break-all max-w-xs">{roomUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(roomUrl)}
              className="text-sm text-indigo-600 hover:underline"
            >
              URLをコピー
            </button>
            <button onClick={() => setShowQr(false)} className="text-sm text-gray-400 hover:text-gray-600">
              閉じる
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                filter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Questions */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">質問がありません</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <div
                key={q.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 ${
                  q.isHidden ? "opacity-50" : ""
                } ${q.status === "pending" ? "border-orange-200" : "border-gray-100"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center min-w-[36px] text-gray-400">
                    <span className="text-lg">▲</span>
                    <span className="text-xs font-bold text-gray-600">{q.likes}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {q.authorName && (
                        <span className="text-xs text-gray-400">{q.authorName}</span>
                      )}
                      {statusBadge(q.status)}
                      {q.isAnswered && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                          回答済み
                        </span>
                      )}
                      {q.isHidden && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          非表示
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                  {q.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(q)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => rejectQuestion(room.id, q.id)}
                        className="px-3 py-1.5 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50"
                      >
                        却下
                      </button>
                    </>
                  )}
                  {q.status === "approved" && (
                    <button
                      onClick={() => markAnswered(room.id, q.id, !q.isAnswered)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        q.isAnswered
                          ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {q.isAnswered ? "未回答に戻す" : "回答済みにする"}
                    </button>
                  )}
                  <button
                    onClick={() => toggleHidden(room.id, q.id, !q.isHidden)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                  >
                    {q.isHidden ? "表示する" : "非表示"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
