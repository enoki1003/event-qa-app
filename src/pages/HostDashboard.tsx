import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { isHostAuth } from "./HostLogin";
import { useRooms, createRoom, deleteRoom, duplicateRoom } from "../hooks/useRooms";
import type { AuthorMode, Room, RoomSettings } from "../types";

const AUTHOR_OPTIONS: { value: AuthorMode; label: string }[] = [
  { value: "anonymous", label: "匿名" },
  { value: "both_optional", label: "会社名（任意）/ 名前（任意）" },
  { value: "company_req_name_opt", label: "会社名（必須）/ 名前（任意）" },
  { value: "both_required", label: "会社名（必須）/ 名前（必須）" },
];

const DEFAULT_SETTINGS: RoomSettings = {
  authorMode: "anonymous",
  slackWebhookUrl: "",
  requireApproval: false,
  showTimestamp: false,
  replyAuthorLabel: "",
};

interface FormState {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  settings: RoomSettings;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  eventDate: "",
  eventTime: "",
  settings: DEFAULT_SETTINGS,
};

function formatEventDate(date: string, time: string) {
  if (!date) return null;
  const d = new Date(date);
  const dateStr = d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  return time ? `${dateStr} ${time}` : dateStr;
}

export default function HostDashboard() {
  const navigate = useNavigate();
  const { rooms, loading } = useRooms();
  const [showCreate, setShowCreate] = useState(false);
  const [qrTarget, setQrTarget] = useState<{ url: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHostAuth()) navigate("/host");
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.eventDate || saving) return;
    setSaving(true);
    try {
      const id = await createRoom(form.title, form.description, form.eventDate, form.eventTime, form.settings);
      setShowCreate(false);
      navigate(`/host/room/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const updS = (patch: Partial<RoomSettings>) => setForm((f) => ({ ...f, settings: { ...f.settings, ...patch } }));
  const roomUrl = (code: string) => `${window.location.origin}/room/${code}`;

  const handleDuplicate = async (room: Room) => {
    if (duplicating) return;
    setDuplicating(room.id);
    try {
      const id = await duplicateRoom(room);
      navigate(`/host/room/${id}`);
    } finally {
      setDuplicating(null);
    }
  };

  const downloadQr = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !qrTarget) return;
    const link = document.createElement("a");
    link.download = `${qrTarget.title}_QR.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const filteredRooms = rooms.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">イベント管理</h1>
          <button
            onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors"
          >
            ＋ 新規イベント
          </button>
        </div>

        {/* 検索バー */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="イベント名で検索..."
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
          />
        </div>

        {/* 新規作成モーダル */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="font-bold text-gray-900 mb-4">新規イベント作成</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">タイトル *</label>
                  <input type="text" value={form.title} onChange={(e) => upd({ title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">説明</label>
                  <textarea value={form.description} onChange={(e) => upd({ description: e.target.value })}
                    rows={2} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">開催日 *</label>
                    <input type="date" value={form.eventDate} onChange={(e) => upd({ eventDate: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" required />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">開催時間（任意）</label>
                    <input type="time" value={form.eventTime} onChange={(e) => upd({ eventTime: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">投稿者情報</label>
                  <select value={form.settings.authorMode} onChange={(e) => updS({ authorMode: e.target.value as AuthorMode })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300">
                    {AUTHOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.settings.requireApproval} onChange={(e) => updS({ requireApproval: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  承認制にする（承認後に参加者画面に表示）
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.settings.showTimestamp} onChange={(e) => updS({ showTimestamp: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  投稿日時を表示する
                </label>
                <div>
                  <label className="text-sm font-medium text-gray-700">Slack Webhook URL（任意）</label>
                  <input type="url" value={form.settings.slackWebhookUrl} onChange={(e) => updS({ slackWebhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 text-sm" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm">キャンセル</button>
                  <button type="submit" disabled={!form.title.trim() || !form.eventDate || saving}
                    className="flex-1 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-40 text-sm font-medium">
                    {saving ? "作成中..." : "作成"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QRモーダル */}
        {qrTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrTarget(null)}>
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <QRCodeSVG value={qrTarget.url} size={240} />
              {/* 保存用の非表示Canvas */}
              <div ref={qrCanvasRef} style={{ display: "none" }}>
                <QRCodeCanvas value={qrTarget.url} size={400} />
              </div>
              <p className="text-sm text-gray-500 font-mono break-all max-w-xs text-center">{qrTarget.url}</p>
              <div className="flex gap-3">
                <button
                  onClick={downloadQr}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
                >
                  QR画像を保存
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(qrTarget.url)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  URLをコピー
                </button>
              </div>
              <button onClick={() => setQrTarget(null)} className="text-sm text-gray-400 hover:text-gray-600">閉じる</button>
            </div>
          </div>
        )}

        {/* イベント一覧 */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? "検索に一致するイベントがありません" : "イベントがありません。「新規イベント」から作成してください。"}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRooms.map((room) => (
              <div key={room.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{room.title}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${room.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {room.isOpen ? "受付中" : "締切"}
                      </span>
                    </div>
                    {room.eventDate && (
                      <p className="text-xs text-amber-700 font-medium mt-0.5">
                        📅 {formatEventDate(room.eventDate, room.eventTime)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      コード: <span className="font-bold text-gray-600">{room.code}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => navigate(`/host/room/${room.id}`)} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600">管理</button>
                  <button onClick={() => setQrTarget({ url: roomUrl(room.code), title: room.title })} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">QRコード</button>
                  <button onClick={() => navigator.clipboard.writeText(roomUrl(room.code))} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">URLコピー</button>
                  <button
                    onClick={() => handleDuplicate(room)}
                    disabled={duplicating === room.id}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    {duplicating === room.id ? "複製中..." : "複製"}
                  </button>
                  <button onClick={() => { if (confirm(`「${room.title}」を削除しますか？質問も全て削除されます。`)) deleteRoom(room.id); }}
                    className="px-3 py-1.5 border border-red-100 text-red-400 text-xs rounded-lg hover:bg-red-50">削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
