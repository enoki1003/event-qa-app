import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { isHostAuth } from "./HostLogin";
import { useRoomById } from "../hooks/useRoom";
import { useQuestions, approveQuestion, rejectQuestion, markAnswered, toggleHidden, addReply } from "../hooks/useQuestions";
import { toggleRoomOpen, addSession, setActiveSession, deleteSession } from "../hooks/useRooms";
import type { Question, QuestionStatus, Session } from "../types";

type QFilter = "all" | "pending" | "approved" | "answered";

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
  } catch { /* サイレント */ }
}

function exportCsv(questions: Question[], roomTitle: string) {
  const rows = [
    ["ID", "セッション", "質問", "会社名", "投稿者", "いいね数", "ステータス", "回答済み", "投稿日時"],
    ...questions.map((q) => [
      q.id,
      q.sessionTitle || "（セッションなし）",
      `"${q.text.replace(/"/g, '""')}"`,
      q.companyName || "",
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

  const [qFilter, setQFilter] = useState<QFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [showQr, setShowQr] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [addingSession, setAddingSession] = useState(false);
  const [tab, setTab] = useState<"questions" | "sessions">("questions");

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

  const sessions: Session[] = Object.entries(room.sessions || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => a.order - b.order);

  const activeSessionId = room.activeSessionId ?? null;

  const getSessionTitle = (id: string | null) => {
    if (!id || id === "ALL") return null;
    return sessions.find((s) => s.id === id)?.title ?? null;
  };

  const currentLabel = !activeSessionId
    ? "受付停止中"
    : activeSessionId === "ALL"
    ? "全セッション受付中"
    : `${getSessionTitle(activeSessionId) ?? activeSessionId} 受付中`;

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim() || addingSession) return;
    setAddingSession(true);
    try {
      await addSession(roomId!, newSessionTitle.trim(), sessions.length);
      setNewSessionTitle("");
      setShowSessionForm(false);
    } finally {
      setAddingSession(false);
    }
  };

  const handleStartSession = async (sessionId: string) => {
    await setActiveSession(roomId!, sessionId);
  };

  const handleStartAll = async () => {
    await setActiveSession(roomId!, "ALL");
  };

  const handleStopAll = async () => {
    await setActiveSession(roomId!, null);
  };

  // 質問フィルタリング
  const bySession = sessionFilter === "all"
    ? questions
    : sessionFilter === "none"
    ? questions.filter((q) => !q.sessionId)
    : questions.filter((q) => q.sessionId === sessionFilter);

  const filtered = bySession.filter((q) => {
    if (qFilter === "pending") return q.status === "pending";
    if (qFilter === "approved") return q.status === "approved" && !q.isAnswered;
    if (qFilter === "answered") return q.isAnswered;
    return true;
  });

  const counts = {
    all: bySession.length,
    pending: bySession.filter((q) => q.status === "pending").length,
    approved: bySession.filter((q) => q.status === "approved" && !q.isAnswered).length,
    answered: bySession.filter((q) => q.isAnswered).length,
  };

  const handleApprove = async (q: Question) => {
    await approveQuestion(room.id, q.id);
    if (room.settings.slackWebhookUrl) {
      await notifySlack(room.settings.slackWebhookUrl, q, room.title);
    }
  };

  const Q_FILTERS: { key: QFilter; label: string }[] = [
    { key: "all", label: `全て (${counts.all})` },
    { key: "pending", label: `承認待ち (${counts.pending})` },
    { key: "approved", label: `承認済み (${counts.approved})` },
    { key: "answered", label: `回答済み (${counts.answered})` },
  ];


  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/host/dashboard")} className="text-gray-400 hover:text-gray-600 text-sm">
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
            >
              QR
            </button>
            <button
              onClick={() => toggleRoomOpen(room.id, !room.isOpen)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                room.isOpen ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {room.isOpen ? "受付中" : "締切"}
            </button>
            <button
              onClick={() => exportCsv(questions, room.title)}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
            >
              CSV
            </button>
          </div>
        </div>

        {/* セッション状態バー */}
        <div className={`px-4 py-1.5 text-xs font-medium text-center ${
          !activeSessionId ? "bg-gray-100 text-gray-500"
          : activeSessionId === "ALL" ? "bg-blue-50 text-blue-700"
          : "bg-indigo-50 text-indigo-700"
        }`}>
          {currentLabel}
        </div>

        {/* Tab */}
        <div className="max-w-3xl mx-auto px-4 flex gap-4 border-t border-gray-50">
          {(["questions", "sessions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "questions" ? "質問" : "セッション"}
            </button>
          ))}
        </div>
      </div>

      {/* QR modal */}
      {showQr && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <QRCodeSVG value={roomUrl} size={240} />
            <p className="text-sm text-gray-500 font-mono text-center break-all max-w-xs">{roomUrl}</p>
            <button onClick={() => navigator.clipboard.writeText(roomUrl)} className="text-sm text-indigo-600 hover:underline">URLをコピー</button>
            <button onClick={() => setShowQr(false)} className="text-sm text-gray-400 hover:text-gray-600">閉じる</button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* ---- セッション管理タブ ---- */}
        {tab === "sessions" && (
          <div className="space-y-4">
            {/* 受付コントロール */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">受付コントロール</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleStartAll}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    activeSessionId === "ALL"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-blue-200 text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  全セッション受付
                </button>
                <button
                  onClick={handleStopAll}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    !activeSessionId
                      ? "bg-gray-600 text-white border-gray-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  受付停止
                </button>
              </div>
            </div>

            {/* セッション一覧 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">セッション一覧</p>
                <button
                  onClick={() => setShowSessionForm(true)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  ＋ セッション追加
                </button>
              </div>

              {showSessionForm && (
                <form onSubmit={handleAddSession} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    placeholder="セッション名を入力"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    disabled={addingSession}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSessionForm(false)}
                    className="px-3 py-2 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </form>
              )}

              {sessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">セッションがありません</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session, i) => {
                    const isActive = activeSessionId === session.id;
                    const sessionQCount = questions.filter((q) => q.sessionId === session.id).length;
                    return (
                      <div
                        key={session.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          isActive ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{session.title}</p>
                          <p className="text-xs text-gray-400">{sessionQCount}件の質問</p>
                        </div>
                        {isActive && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">受付中</span>
                        )}
                        <div className="flex gap-1">
                          {!isActive && (
                            <button
                              onClick={() => handleStartSession(session.id)}
                              className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
                            >
                              開始
                            </button>
                          )}
                          {isActive && (
                            <button
                              onClick={handleStopAll}
                              className="px-2 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                            >
                              停止
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`「${session.title}」を削除しますか？`)) {
                                deleteSession(roomId!, session.id);
                                if (isActive) setActiveSession(roomId!, null);
                              }
                            }}
                            className="px-2 py-1 border border-red-100 text-red-400 text-xs rounded-lg hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- 質問タブ ---- */}
        {tab === "questions" && (
          <div className="space-y-3">
            {/* セッション絞り込み */}
            {sessions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSessionFilter("all")}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    sessionFilter === "all" ? "bg-gray-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  全セッション
                </button>
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSessionFilter(s.id)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                      sessionFilter === s.id ? "bg-gray-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
                <button
                  onClick={() => setSessionFilter("none")}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    sessionFilter === "none" ? "bg-gray-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  未分類
                </button>
              </div>
            )}

            {/* ステータスフィルタ */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Q_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setQFilter(f.key)}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    qFilter === f.key ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 質問一覧 */}
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">質問がありません</div>
            ) : (
              filtered.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  roomId={room.id}
                  slackWebhookUrl={room.settings.slackWebhookUrl}
                  roomTitle={room.title}
                  onApprove={handleApprove}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- QuestionCard コンポーネント ----

interface QuestionCardProps {
  q: Question;
  roomId: string;
  roomTitle: string;
  slackWebhookUrl: string;
  onApprove: (q: Question) => void;
}

function QuestionCard({ q, roomId, onApprove }: QuestionCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);

  const byLine = [q.companyName, q.authorName].filter(Boolean).join(" / ");
  const replies = Object.entries(q.replies || {})
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => a.createdAt - b.createdAt);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await addReply(roomId, q.id, replyText, isPrivate);
      setReplyText("");
      setShowReplyForm(false);
    } finally {
      setSendingReply(false);
    }
  };

  const statusBadge = (status: Question["status"]) => {
    if (status === "approved") return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">承認済み</span>;
    if (status === "rejected") return <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">却下</span>;
    return <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">承認待ち</span>;
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${q.isHidden ? "opacity-50" : ""} ${
      q.status === "pending" ? "border-orange-200" : "border-gray-100"
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center min-w-[36px] text-gray-400">
          <span className="text-lg">▲</span>
          <span className="text-xs font-bold text-gray-600">{q.likes}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {byLine && <span className="text-xs text-gray-400">{byLine}</span>}
            {q.sessionTitle && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{q.sessionTitle}</span>
            )}
            {statusBadge(q.status)}
            {q.isAnswered && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">回答済み</span>
            )}
            {q.isHidden && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">非表示</span>
            )}
          </div>
        </div>
      </div>

      {/* 返信一覧 */}
      {replies.length > 0 && (
        <div className="mt-3 ml-10 space-y-2">
          {replies.map((r) => (
            <div key={r.id} className={`text-xs rounded-xl px-3 py-2 ${
              r.isPrivate ? "bg-yellow-50 border border-yellow-100" : "bg-indigo-50 border border-indigo-100"
            }`}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-medium text-gray-600">返信</span>
                {r.isPrivate && <span className="text-yellow-600">（投稿者のみ）</span>}
              </div>
              <p className="text-gray-700">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* アクション */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
        {q.status === "pending" && (
          <button onClick={() => onApprove(q)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">
            承認
          </button>
        )}
        {q.status === "pending" && (
          <button onClick={() => rejectQuestion(roomId, q.id)} className="px-3 py-1.5 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50">
            却下
          </button>
        )}
        {q.status === "approved" && (
          <button
            onClick={() => markAnswered(roomId, q.id, !q.isAnswered)}
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
          onClick={() => toggleHidden(roomId, q.id, !q.isHidden)}
          className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
        >
          {q.isHidden ? "表示する" : "非表示"}
        </button>
        <button
          onClick={() => setShowReplyForm((v) => !v)}
          className="px-3 py-1.5 border border-indigo-200 text-indigo-600 text-xs rounded-lg hover:bg-indigo-50"
        >
          返信する
        </button>
      </div>

      {/* 返信フォーム */}
      {showReplyForm && (
        <form onSubmit={handleReply} className="mt-3 ml-10 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="返信内容を入力..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            required
            autoFocus
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!isPrivate}
                onChange={(e) => setIsPrivate(!e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600"
              />
              全体にも公開する
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReplyForm(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!replyText.trim() || sendingReply}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                {sendingReply ? "送信中..." : isPrivate ? "送信（投稿者のみ）" : "送信（全体に公開）"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
