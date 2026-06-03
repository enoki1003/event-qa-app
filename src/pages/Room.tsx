import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoomByCode } from "../hooks/useRoom";
import { useQuestions, submitQuestion } from "../hooks/useQuestions";
import { useSession } from "../hooks/useSession";
import { recordVisit, updateVisitorInfo } from "../hooks/useVisitors";
import type { AuthorMode } from "../types";

const STORAGE_KEY = "qa_author_info";

function loadAuthorInfo() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveAuthorInfo(companyName: string, authorName: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ companyName, authorName }));
}

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

  const saved = loadAuthorInfo();
  const [text, setText] = useState("");
  const [companyName, setCompanyName] = useState(saved.companyName || "");
  const [authorName, setAuthorName] = useState(saved.authorName || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");

  useEffect(() => {
    saveAuthorInfo(companyName, authorName);
  }, [companyName, authorName]);

  // 入室記録（roomIdが確定したら一度だけ）
  useEffect(() => {
    if (room?.id) recordVisit(room.id, sessionId);
  }, [room?.id, sessionId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">読み込み中...</div></div>;
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-500">{error || "ルームが見つかりません"}</p>
        <button onClick={() => navigate("/")} className="text-amber-700 hover:underline text-sm">トップに戻る</button>
      </div>
    );
  }

  if (!room.isOpen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-4xl">🔒</div>
        <p className="text-gray-600 font-medium">このルームは現在締め切られています</p>
        <button onClick={() => navigate("/")} className="text-amber-700 hover:underline text-sm">トップに戻る</button>
      </div>
    );
  }

  const { settings } = room;
  const mode = settings.authorMode;
  const showCompany = needsCompany(mode);
  const showName = needsName(mode);
  const companyRequired = isCompanyRequired(mode);
  const nameRequired = isNameRequired(mode);

  const activeSessionId = room.activeSessionId ?? null;
  const sessions = Object.entries(room.sessions || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => a.order - b.order);
  const activeSession = activeSessionId && activeSessionId !== "ALL"
    ? sessions.find((s) => s.id === activeSessionId)
    : null;

  const canSubmit = text.trim() && !submitting &&
    (!companyRequired || companyName.trim()) &&
    (!nameRequired || authorName.trim());

  const visibleQuestions = questions.filter(
    (q) => !q.isHidden && (q.status === "approved" || q.browserSessionId === sessionId)
  );
  const sorted = [...visibleQuestions].sort((a, b) =>
    sortOrder === "new" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
  );

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
        activeSessionId,
        activeSession?.title ?? null
      );
      setText("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      // 投稿者情報をvisitorsに反映
      updateVisitorInfo(
        room.id,
        sessionId,
        showCompany ? companyName : null,
        showName ? authorName : null
      );
    } catch {
      setSubmitError("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  const sessionBannerTitle = activeSession?.title ?? (activeSessionId === "ALL" ? null : null);
  const sessionBannerDesc = activeSession?.description ?? null;
  const replyLabel = settings.replyAuthorLabel || "登壇者";

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3">
          <h1 className="font-bold text-gray-900 truncate">{room.title}</h1>
          {room.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{room.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* セッションバナー */}
        {(sessionBannerTitle || sessionBannerDesc) && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            {sessionBannerTitle && (
              <p className="text-sm font-semibold text-amber-800">▶ {sessionBannerTitle}</p>
            )}
            {sessionBannerDesc && (
              <p className="text-xs text-amber-700 mt-1">{sessionBannerDesc}</p>
            )}
          </div>
        )}

        {/* 投稿フォーム */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">質問を投稿する</p>
          </div>
          <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
            {showCompany && (
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder={`会社名${companyRequired ? "（必須）" : "（任意）"}`} maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2"
                required={companyRequired} />
            )}
            {showName && (
              <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)}
                placeholder={`お名前${nameRequired ? "（必須）" : "（任意）"}`} maxLength={50}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2"
                required={nameRequired} />
            )}
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="質問を入力してください..." maxLength={1000} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              required />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">{text.length}/1000</span>
              <button type="submit" disabled={!canSubmit}
                className="px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
        </div>

        {/* 質問一覧 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              質問一覧 {sorted.length > 0 && <span className="text-gray-400">({sorted.length})</span>}
            </p>
            <div className="flex gap-1">
              {(["new", "old"] as const).map((o) => (
                <button key={o} onClick={() => setSortOrder(o)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${sortOrder === o ? "bg-amber-100 text-amber-800 font-medium" : "text-gray-400 hover:text-gray-600"}`}>
                  {o === "new" ? "新しい順" : "古い順"}
                </button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">まだ質問がありません</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sorted.map((q) => {
                const isPending = q.status === "pending";
                const byLine = [q.companyName, q.authorName].filter(Boolean).join(" / ");
                const isOwn = q.browserSessionId === sessionId;
                const replies = Object.entries(q.replies || {})
                  .map(([id, r]) => ({ id, ...r }))
                  .filter((r) => !r.isPrivate || isOwn)
                  .sort((a, b) => a.createdAt - b.createdAt);

                return (
                  <div key={q.id} className={`px-4 py-3 ${q.isAnswered ? "opacity-60" : ""} ${isPending ? "bg-gray-50" : ""}`}>
                    <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {byLine && <span className="text-xs text-gray-400">{byLine}</span>}
                      {isPending && (
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">承認待ち</span>
                      )}
                      {q.isAnswered && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">回答済み</span>
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
                          <div key={r.id} className={`text-xs rounded-xl px-3 py-2 flex gap-2 ${r.isPrivate ? "bg-yellow-50 border border-yellow-100" : "bg-amber-50 border border-amber-100"}`}>
                            <span className="text-gray-400 flex-shrink-0">↪</span>
                            <div>
                              <span className="font-medium text-amber-800">{replyLabel}</span>
                              {r.isPrivate && <span className="text-yellow-600 ml-1">（あなただけに表示）</span>}
                              <p className="text-gray-700 mt-0.5">{r.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
