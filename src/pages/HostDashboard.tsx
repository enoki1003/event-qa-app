import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { isHostAuth } from "./HostLogin";
import { useRooms, createRoom, updateRoomSettings, toggleRoomOpen, deleteRoom } from "../hooks/useRooms";
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
};

type ModalMode = "create" | "edit";

interface RoomFormState {
  title: string;
  description: string;
  settings: RoomSettings;
}

const EMPTY_FORM: RoomFormState = {
  title: "",
  description: "",
  settings: DEFAULT_SETTINGS,
};

export default function HostDashboard() {
  const navigate = useNavigate();
  const { rooms, loading } = useRooms();
  const [modal, setModal] = useState<{ mode: ModalMode; room?: Room } | null>(null);
  const [qrTarget, setQrTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!isHostAuth()) navigate("/host");
  }, [navigate]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModal({ mode: "create" });
  };

  const openEdit = (room: Room) => {
    setForm({
      title: room.title,
      description: room.description || "",
      settings: { ...DEFAULT_SETTINGS, ...room.settings },
    });
    setModal({ mode: "edit", room });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      if (modal?.mode === "create") {
        const id = await createRoom(form.title, form.description, form.settings);
        setModal(null);
        navigate(`/host/room/${id}`);
      } else if (modal?.mode === "edit" && modal.room) {
        await updateRoomSettings(modal.room.id, form.title, form.description, form.settings);
        setModal(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (patch: Partial<RoomFormState>) => setForm((f) => ({ ...f, ...patch }));
  const updateSettings = (patch: Partial<RoomSettings>) =>
    setForm((f) => ({ ...f, settings: { ...f.settings, ...patch } }));

  const roomUrl = (code: string) => `${window.location.origin}/room/${code}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">イベント管理</h1>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors"
          >
            ＋ 新規イベント
          </button>
        </div>

        {/* Create / Edit modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="font-bold text-gray-900 mb-4">
                {modal.mode === "create" ? "新規イベント作成" : "イベント設定を編集"}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">タイトル *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm({ title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">説明</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm({ description: e.target.value })}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">投稿者情報</label>
                  <select
                    value={form.settings.authorMode}
                    onChange={(e) => updateSettings({ authorMode: e.target.value as AuthorMode })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    {AUTHOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="approval"
                    checked={form.settings.requireApproval}
                    onChange={(e) => updateSettings({ requireApproval: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <label htmlFor="approval" className="text-sm text-gray-700">
                    承認制にする（承認後に参加者画面に表示）
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="timestamp"
                    checked={form.settings.showTimestamp}
                    onChange={(e) => updateSettings({ showTimestamp: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <label htmlFor="timestamp" className="text-sm text-gray-700">
                    投稿日時を表示する
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Slack Webhook URL（任意）
                  </label>
                  <input
                    type="url"
                    value={form.settings.slackWebhookUrl}
                    onChange={(e) => updateSettings({ slackWebhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">承認した質問をリアルタイムでSlackに投稿します</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!form.title.trim() || saving}
                    className="flex-1 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 text-sm font-medium"
                  >
                    {saving ? "保存中..." : modal.mode === "create" ? "作成" : "保存"}
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
              <button onClick={() => setQrTarget(null)} className="text-sm text-gray-400 hover:text-gray-600">
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
              <div key={room.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900 truncate">{room.title}</h2>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          room.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
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
                    className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600"
                  >
                    管理
                  </button>
                  <button
                    onClick={() => openEdit(room)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                  >
                    設定編集
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
