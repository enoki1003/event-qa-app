import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoomByCode } from "../hooks/useRoom";
import { useQuestions, submitQuestion, toggleLike } from "../hooks/useQuestions";
import { useSession } from "../hooks/useSession";
import type { AuthorMode } from "../types";

function authorLabel(mode: AuthorMode, label: string): string {
  if (mode === "name") return label || "お名前";
  if (mode === "company") return label || "会社名";
  if (mode === "name_company") return label || "会社名・お名前";
  return "";
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const sessionId = useSession();
  const { room, loading, error } = useRoomByCode(code ?? "");
  const questions = useQuestions(room?.id ?? "");

  const [text, setText] = useState("");
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
  const needsAuthor = mode !== "anonymous";
  const label = authorLabel(mode, settings.nameLabel);

  const visibleQuestions = questions.filter(
    (q) => !q.isHidden && (q.status === "approved" || q.sessionId === sessionId)
  );
  const sorted = [...visibleQuestions].sort((a, b) => b.likes - a.likes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    if (needsAuthor && !authorName.trim()) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      await submitQuestion(room.id, { text, authorName: needsAuthor ? authorName : null }, sessionId, settings);
      setText("");
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

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3">
          <h1 className="font-bold text-gray-900 truncate">{room.title}</h1>
          {room.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{room.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Submit form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {needsAuthor && (
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={label}
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
              required
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
              disabled={!text.trim() || submitting || (needsAuthor && !authorName.trim())}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "送信中..." : "質問する"}
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
                      {q.authorName && (
                        <span className="text-xs text-gray-400">{q.authorName}</span>
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
                    </div>
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
