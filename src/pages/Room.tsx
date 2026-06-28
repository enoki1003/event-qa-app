import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoomByCode } from "../hooks/useRoom";
import { useQuestions, submitQuestion } from "../hooks/useQuestions";
import { useSession } from "../hooks/useSession";
import { recordVisit, updateVisitorInfo } from "../hooks/useVisitors";
import { usePolls, castVote } from "../hooks/usePolls";
import type { AuthorMode, Poll } from "../types";

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
  const { polls } = usePolls(room?.id ?? "");

  const saved = loadAuthorInfo();
  const [text, setText] = useState("");
  const [companyName, setCompanyName] = useState(saved.companyName || "");
  const [authorName, setAuthorName] = useState(saved.authorName || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");

  // 回答済み通知
  const prevAnsweredRef = useRef<Set<string> | null>(null);
  const [notification, setNotification] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    saveAuthorInfo(companyName, authorName);
  }, [companyName, authorName]);

  // 入室記録（roomIdが確定したら一度だけ）
  useEffect(() => {
    if (room?.id) recordVisit(room.id, sessionId);
  }, [room?.id, sessionId]);

  // 自分の質問が回答済みになったら通知
  useEffect(() => {
    if (!questions.length) return;
    const myAnswered = questions.filter(
      (q) => q.browserSessionId === sessionId && q.isAnswered
    );
    const currentIds = new Set(myAnswered.map((q) => q.id));
    if (prevAnsweredRef.current === null) {
      prevAnsweredRef.current = currentIds;
      return;
    }
    const newlyAnswered = myAnswered.find((q) => !prevAnsweredRef.current!.has(q.id));
    if (newlyAnswered) {
      setNotification({ id: newlyAnswered.id, text: newlyAnswered.text });
      setTimeout(() => setNotification(null), 8000);
    }
    prevAnsweredRef.current = currentIds;
  }, [questions, sessionId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">読み込み中...</div></div>;
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-500">{error || "ルームが見つかりません"}</p>
        <button onClick={() => navigate("/")} className="text-rimo-600 hover:underline text-sm">トップに戻る</button>
      </div>
    );
  }

  if (!room.isOpen) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <img src="/rimo_logo.svg" alt="Rimo" className="h-6 opacity-60" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center space-y-4">
            <p className="font-semibold text-gray-800">
              本日はご参加いただき<br />
              誠にありがとうございました！
            </p>
            {room.settings.ctaUrl && (
              <a
                href={room.settings.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 text-white text-sm font-semibold rounded-full text-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#F18900" }}
              >
                {room.settings.ctaLabel || "無料相談の予約はこちら"}
              </a>
            )}
            {room.settings.surveyUrl && (
              <a
                href={room.settings.surveyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 text-sm font-semibold rounded-full text-center border transition-opacity hover:opacity-80 bg-white"
                style={{ color: "#F18900", borderColor: "#F18900" }}
              >
                {room.settings.surveyLabel || "アンケートに回答する"}
              </a>
            )}
            {!room.settings.ctaUrl && !room.settings.surveyUrl && (
              <p className="text-sm text-gray-400">またのご参加をお待ちしています。</p>
            )}
          </div>
        </div>
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
  const activePolls = polls.filter((p) => !p.isHidden && (p.status === "active" || p.status === "closed"));

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-8">
      {/* 回答済み通知バナー */}
      {notification && (
        <div className="fixed top-9 left-0 right-0 z-50 flex justify-center px-4 pt-2 pointer-events-none">
          <div className="bg-white border border-rimo-200 rounded-xl shadow-lg px-4 py-3 max-w-sm w-full pointer-events-auto">
            <div className="flex items-start gap-3">
              <span className="text-rimo-500 flex-shrink-0 mt-0.5 text-base">💬</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-rimo-700">あなたの質問が取り上げられました</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">「{notification.text}」</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-300 hover:text-gray-500 flex-shrink-0 text-sm leading-none"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 薄いsticky バー（ロゴのみ） */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-end">
          <img src="/rimo_logo.svg" alt="Rimo" className="h-4 opacity-90" />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* イベントタイトル */}
        <div>
          <h1 className="font-bold text-gray-900 text-base leading-snug">{room.title}</h1>
          {room.description && (
            <p className="text-sm text-gray-500 mt-1 leading-snug">{room.description}</p>
          )}
        </div>
        {/* CTAボタン */}
        {settings.ctaUrl && (
          <a
            href={settings.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 text-white text-sm font-semibold rounded-full text-center transition-opacity hover:opacity-90 shadow-sm"
            style={{ backgroundColor: "#F18900" }}
          >
            {settings.ctaLabel || "詳細・お申し込みはこちら"}
          </a>
        )}

        {/* アンケートボタン */}
        {settings.surveyUrl && (
          <a
            href={settings.surveyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 text-sm font-semibold rounded-full text-center border transition-opacity hover:opacity-80 bg-white shadow-sm"
            style={{ color: "#F18900", borderColor: "#F18900" }}
          >
            {settings.surveyLabel || "アンケートに回答する"}
          </a>
        )}

        {/* セッションバナー */}
        {(sessionBannerTitle || sessionBannerDesc) && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            {sessionBannerTitle && (
              <p className="text-sm font-semibold text-gray-800">▶ {sessionBannerTitle}</p>
            )}
            {sessionBannerDesc && (
              <p className="text-xs text-gray-600 mt-1">{sessionBannerDesc}</p>
            )}
          </div>
        )}

        {/* 投票カード */}
        {activePolls.map((poll) => (
          <PollCard key={poll.id} poll={poll} roomId={room.id} sessionId={sessionId} />
        ))}

        {/* 投稿フォーム */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">質問を投稿する</p>
          </div>
          <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
            {showCompany && (
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder={`会社名${companyRequired ? "（必須）" : "（任意）"}`} maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rimo-300 mb-2"
                required={companyRequired} />
            )}
            {showName && (
              <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)}
                placeholder={`お名前${nameRequired ? "（必須）" : "（任意）"}`} maxLength={50}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rimo-300 mb-2"
                required={nameRequired} />
            )}
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="質問を入力してください..." maxLength={1000} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rimo-300 resize-none"
              required />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">{text.length}/1000</span>
              <button type="submit" disabled={!canSubmit}
                className="px-5 py-2 bg-rimo-500 text-white text-sm font-medium rounded-full hover:bg-rimo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {submitting ? "送信中..." : "投稿する"}
              </button>
            </div>
            {submitted && (
              <p className="text-sm text-rimo-600 mt-2">
                {settings.requireApproval ? "質問を送信しました（承認後に表示されます）" : "質問を送信しました！"}
              </p>
            )}
            {submitError && <p className="text-sm text-red-500 mt-2">{submitError}</p>}
          </form>
        </div>

        {/* 質問一覧 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              質問一覧 {sorted.length > 0 && <span className="text-gray-400">({sorted.length})</span>}
            </p>
            <div className="flex gap-1">
              {(["new", "old"] as const).map((o) => (
                <button key={o} onClick={() => setSortOrder(o)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${sortOrder === o ? "bg-rimo-100 text-rimo-700 font-medium" : "text-gray-400 hover:text-gray-600"}`}>
                  {o === "new" ? "新しい順" : "古い順"}
                </button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">まだ質問がありません</div>
          ) : (
            <div className="px-4 pb-4 space-y-3">
              {sorted.map((q) => {
                const isPending = q.status === "pending";
                const byLine = [q.companyName, q.authorName].filter(Boolean).join(" / ");
                const isOwn = q.browserSessionId === sessionId;
                const replies = Object.entries(q.replies || {})
                  .map(([id, r]) => ({ id, ...r }))
                  .filter((r) => !r.isPrivate || isOwn)
                  .sort((a, b) => a.createdAt - b.createdAt);

                return (
                  <div key={q.id} className={`border rounded-lg px-3 py-2 ${q.isAnswered ? "opacity-60" : ""} ${isPending ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200"}`}>
                    <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {byLine && <span className="text-xs text-gray-400">{byLine}</span>}
                      {isPending && (
                        <span className="text-xs text-rimo-600 bg-rimo-100 px-2 py-0.5 rounded-full">承認待ち</span>
                      )}
                      {q.isAnswered && (
                        <span className="text-xs text-rimo-600 bg-rimo-50 px-2 py-0.5 rounded-full">回答済み</span>
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
                          <div key={r.id} className={`text-xs rounded-xl px-3 py-2 flex gap-2 ${r.isPrivate ? "bg-yellow-50 border border-yellow-100" : "bg-rimo-50 border border-rimo-100"}`}>
                            <span className="text-gray-400 flex-shrink-0">↪</span>
                            <div>
                              <span className="font-medium text-rimo-700">{replyLabel}</span>
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

// ---- 投票カード ----

const CIRCLE_NUMS = ["①", "②", "③", "④", "⑤"];

interface PollCardProps {
  poll: Poll;
  roomId: string;
  sessionId: string;
}

function PollCard({ poll, roomId, sessionId }: PollCardProps) {
  const rawVote = poll.votes?.[sessionId];
  const myVotes: number[] = Array.isArray(rawVote) ? rawVote : typeof rawVote === "number" ? [rawVote] : [];
  const hasVoted = myVotes.length > 0;
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const respondents = Object.keys(poll.votes || {}).length;
  const getCount = (i: number) =>
    Object.values(poll.votes || {}).filter((v) => {
      const arr = Array.isArray(v) ? v : typeof v === "number" ? [v] : [];
      return arr.includes(i);
    }).length;
  const getPct = (i: number) => respondents > 0 ? Math.round((getCount(i) / respondents) * 100) : 0;

  const showResults = hasVoted || poll.status === "closed";
  const allowMultiple = poll.allowMultiple ?? false;

  const toggleSelect = (i: number) => {
    if (allowMultiple) {
      setSelected((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
    } else {
      setSelected([i]);
    }
  };

  const handleVote = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await castVote(roomId, poll.id, sessionId, selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm ${poll.status === "active" ? "border-rimo-200" : "border-gray-100"}`}>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${poll.status === "active" ? "bg-rimo-100 text-rimo-700" : "bg-gray-100 text-gray-500"}`}>
          {poll.status === "active" ? "投票受付中" : "投票終了"}
        </span>
        {allowMultiple && (
          <span className="text-xs text-gray-400">複数選択可</span>
        )}
        <span className="text-xs text-gray-400">{respondents}人回答</span>
      </div>
      <div className="px-4 pb-4 pt-2">
        <p className="text-sm font-semibold text-gray-800 mb-3">{poll.title}</p>

        {showResults ? (
          /* 結果表示 */
          <div className="space-y-2">
            {poll.options.map((opt, i) => {
              const pct = getPct(i);
              const isMyVote = myVotes.includes(i);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`truncate max-w-xs ${isMyVote ? "font-semibold text-rimo-700" : "text-gray-700"}`}>
                      <span className="text-gray-400 mr-1">{CIRCLE_NUMS[i]}</span>
                      {isMyVote && "✓ "}{opt}
                    </span>
                    <span className="text-gray-500 flex-shrink-0 ml-2">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${isMyVote ? "bg-rimo-500" : "bg-gray-300"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {hasVoted && <p className="text-xs text-gray-400 mt-2">投票済みです</p>}
          </div>
        ) : (
          /* 投票フォーム */
          <div className="space-y-2">
            {poll.options.map((opt, i) => {
              const isSelected = selected.includes(i);
              return (
                <label
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                    isSelected ? "border-rimo-400 bg-rimo-50" : "border-gray-200 hover:border-rimo-200 hover:bg-rimo-50/30"
                  }`}
                >
                  <input
                    type={allowMultiple ? "checkbox" : "radio"}
                    name={`poll-${poll.id}`}
                    value={i}
                    checked={isSelected}
                    onChange={() => toggleSelect(i)}
                    className="accent-rimo-500"
                  />
                  <span className="text-sm text-gray-800">
                    <span className="text-gray-400 mr-1">{CIRCLE_NUMS[i]}</span>{opt}
                  </span>
                </label>
              );
            })}
            <button
              onClick={handleVote}
              disabled={selected.length === 0 || submitting}
              className="mt-2 w-full py-2.5 bg-rimo-500 text-white text-sm font-medium rounded-full hover:bg-rimo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "送信中..." : "投票する"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
