import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoomByCode } from "../hooks/useRoom";
import { useQuestions, submitQuestion, toggleLike } from "../hooks/useQuestions";
import { useSession } from "../hooks/useSession";
import type { AuthorMode } from "../types";

function needsCompany(mode: AuthorMode) {
  return mode === "both_required" || mode === "company_req_name_opt" || mode === "both_optional";
}
function needsName(mode: AuthorMode) {
  return mode === "both_required" || mode === "company_req_name_opt" || mode === "both_optional";
}
function isCompanyRequired(mode: AuthorMode) {
  return mode === "both_required" || mode === "company_req_name_opt";
}
function isNameRequired(mode: AuthorMode) {
  return mode === "both_required";
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const sessionId = useSession();
  const { room, loading, error } = useRoomByCode(code ?? "");
  const questions = useQuestions(room?.id ?? "");

  const [text, setText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-500">{error || "ルームが見つかりません"}</p>
        <button onClick={() => navigate("/")} className="text-indigo-600 hover:underline text-sm">
          トップに戻る
        </button>
      </div>
    );
  }

  if (!room.isOpen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-4xl">🔒</div>
        <p className="text-gray-600 font-medium">このルームは現在締め切られています</p>
        <button onClick={() => navigate("/")} className="text-indigo-600 hover:underline text-sm">
          トップに戻る
        </button>
      </div>
    );
  }

  const { settings } = room;
  const mode = settings.authorMode;
  const showCompany = needsCompany(mode);
  const showName = needsName(mode);
  const companyRequired = isCompanyRequired(mode);
  const nameRequired = isNameRequired(mode);

  const canSubmit =
    text.trim() &&
    !submitting &&
    (!companyRequired || companyName.trim()) &&
    (!nameRequired || authorName.trim());

  const visibleQuestions = questions.filter(
    (q) => !q.isHidden && (q.status === "approved" || q.browserSessionId === sessionId)
  );
  const sorted = [...visibleQuestions].sort((a, b) => b.likes - a.likes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      await submitQuestion(
        room.id,
        { text, companyName: showCompany ? companyName : null, authorName: showName ? authorName : null },
        sessionId,
        settings,
        room.activeSessionId ?? null,
        activeSession?.title ?? null
      );
      setText("");
      setCompanyName("");
      setAuthorName("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setSubmitError("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = (questionId: string) => {
    toggleLike(room.id, questionId, sessionId);
  };

  const activeSessionId = room.activeSessionId ?? null;
  const activeSession = activeSessionId && activeSessionId !== "ALL"
    ? sessions.find((s) => s.id === activeSessionId)
    : null;
  const sessions = Object.entries(room.sessions || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => a.order - b.order);
  const sessionDescription = activeSession?.description || room.description || "";

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3">
          <h1 className="font-bold text-gray-900 truncate">{room.title}</h1>
          {activeSession && (
            <p className="text-xs text-indigo-500 font-medium mt-0.5">{activeSession.title}</p>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* 案内テキスト */}
        {sessionDescription && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 text-sm text-indigo-800">
            {sessionDescription}
          </div>
        )}
        {/* Submit form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {showCompany && (
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={`会社名${companyRequired ? "（必須）" : "（任意）"}`}
              maxLength={100}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
              required={companyRequired}
            />
          )}
          {showName && (
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={`お名前${nameRequired ? "（必須）" : "（任意）"}`}
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
              required={nameRequired}
            />
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="質問を入力してください..."
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            required
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{text.length}/500</span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "送信中..." : "投稿する"}
            </button>
          </div>
          {submitted && (
            <p className="text-sm text-green-600 mt-2">
              {settings.requireApproval ? "質問を送信しました（承認後に表示されます）" : "質問を送信しました！"}
            </p>
          )}
          {submitError && <p className="text-sm text-red-500 mt-2">{submitError}</p>}
        </form>

        {/* Questions */}
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            まだ質問がありません
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((q) => {
              const liked = !!q.likedBy?.[sessionId];
              const isPending = q.status === "pending";
              const byLine = [q.companyName, q.authorName].filter(Boolean).join(" / ");
              const isOwn = q.browserSessionId === sessionId;
              const replies = Object.entries(q.replies || {})
                .map(([id, r]) => ({ id, ...r }))
                .filter((r) => !r.isPrivate || isOwn)
                .sort((a, b) => a.createdAt - b.createdAt);
              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-3 ${
                    q.isAnswered ? "opacity-60" : ""
                  } ${isPending ? "border-orange-200 bg-orange-50" : "border-gray-100"}`}
                >
                  <button
                    onClick={() => !isPending && handleLike(q.id)}
                    disabled={isPending}
                    className={`flex flex-col items-center min-w-[40px] pt-1 transition-colors ${
                      liked ? "text-indigo-600" : "text-gray-300 hover:text-indigo-400"
                    } ${isPending ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span className="text-lg">▲</span>
                    <span className="text-xs font-bold">{q.likes}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {byLine && (
                        <span className="text-xs text-gray-400">{byLine}</span>
                      )}
                      {isPending && (
                        <span className="text-xs text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">
                          承認待ち
                        </span>
                      )}
                      {q.isAnswered && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          回答済み
                        </span>
                      )}
                      {settings.showTimestamp && q.createdAt && (
                        <span className="text-xs text-gray-300">
                          {new Date(q.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {replies.map((r) => (
                          <div key={r.id} className={`text-xs rounded-xl px-3 py-2 ${
                            r.isPrivate ? "bg-yellow-50 border border-yellow-100" : "bg-indigo-50 border border-indigo-100"
                          }`}>
                            <span className="font-medium text-indigo-700">登壇者より</span>
                            {r.isPrivate && <span className="text-yellow-600 ml-1">（あなただけに表示）</span>}
                            <p className="text-gray-700 mt-0.5">{r.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
