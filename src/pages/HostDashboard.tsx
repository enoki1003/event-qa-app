import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { isHostAuth } from "./HostLogin";
import { useRooms, createRoom, toggleRoomOpen, deleteRoom } from "../hooks/useRooms";
import type { AuthorMode, RoomSettings } from "../types";

const AUTHOR_OPTIONS: { value: AuthorMode; label: string }[] = [
  { value: "anonymous", label: "匿名のみ" },
  { value: "name", label: "名前を入力（任意）" },
  { value: "company", label: "会社名を入力（任意）" },
  { value: "name_company", label: "会社名・名前を入力（任意）" },
];

const DEFAULT_SETTINGS: RoomSettings = {
  authorMode: "anonymous",
  nameLabel: "",
  slackWebhookUrl: "",
  requireApproval: false,
};

export default function HostDashboard() {
  const navigate = useNavigate();
  const { rooms, loading } = useRooms();
  const [showCreate, setShowCreate] = useState(false);
  const [qrTarget, setQrTarget] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!isHostAuth()) navigate("/host");
  }, [navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createRoom(title, description, settings);
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setSettings(DEFAULT_SETTINGS);
      navigate(`/host/room/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const roomUrl = (code: string) =>
    `${window.location.origin}/room/${code}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">イベント管理</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            ＋ 新規イベント
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="font-bold text-gray-900 mb-4">新規イベント作成</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">タイトル *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">説明</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">投稿者情報</label>
                  <select
                    value={settings.authorMode}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, authorMode: e.target.value as AuthorMode }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {AUTHOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {settings.authorMode !== "anonymous" && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">入力欄ラベル（省略可）</label>
                    <input
                      type="text"
                      value={settings.nameLabel}
                      onChange={(e) => setSettings((s) => ({ ...s, nameLabel: e.target.value }))}
                      placeholder="例: 会社名・お名前"
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="approval"
                    checked={settings.requireApproval}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, requireApproval: e.target.checked }))
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <label htmlFor="approval" className="text-sm text-gray-700">
                    質問を承認制にする（承認後に参加者画面に表示）
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Slack Webhook URL（任意）
                  </label>
                  <input
                    type="url"
                    value={settings.slackWebhookUrl}
                    onChange={(e) => setSettings((s) => ({ ...s, slackWebhookUrl: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    承認した質問をリアルタイムでSlackに投稿します
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || creating}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 text-sm font-medium"
                  >
                    {creating ? "作成中..." : "作成"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR modal */}
        {qrTarget && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setQrTarget(null)}
          >
            <div
              className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <QRCodeSVG value={qrTarget} size={240} />
              <p className="text-sm text-gray-500 font-mono break-all max-w-xs text-center">{qrTarget}</p>
              <button
                onClick={() => setQrTarget(null)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* Room list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            イベントがありません。「新規イベント」から作成してください。
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900 truncate">{room.title}</h2>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          room.isOpen
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {room.isOpen ? "受付中" : "締切"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      コード: <span className="font-bold text-gray-600">{room.code}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/host/room/${room.id}`)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                  >
                    管理
                  </button>
                  <button
                    onClick={() => setQrTarget(roomUrl(room.code))}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                  >
                    QRコード
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(roomUrl(room.code))}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                  >
                    URLコピー
                  </button>
                  <button
                    onClick={() => toggleRoomOpen(room.id, !room.isOpen)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                  >
                    {room.isOpen ? "締め切る" : "再開する"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`「${room.title}」を削除しますか？質問も全て削除されます。`)) {
                        deleteRoom(room.id);
                      }
                    }}
                    className="px-3 py-1.5 border border-red-100 text-red-400 text-xs rounded-lg hover:bg-red-50"
                  >
                    削除
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
