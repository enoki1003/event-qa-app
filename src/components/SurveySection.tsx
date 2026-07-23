import { useEffect, useState } from "react";

type SurveyCell = string | number;
type SurveyRow = SurveyCell[];
type ColType = "numeric" | "categorical" | "checkbox" | "text";

const CHART_COLORS = [
  "#4285F4", "#DB4437", "#F4B400", "#0F9D58",
  "#AB47BC", "#00ACC1", "#FF7043", "#9E9D24",
];

export function extractSheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : urlOrId.trim();
}

function detectColType(values: SurveyCell[]): ColType {
  const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "text";

  // Numeric: all values are numbers
  if (nonEmpty.every((v) => typeof v === "number" || (typeof v === "string" && v !== "" && !isNaN(Number(v))))) {
    return "numeric";
  }

  // Checkbox (複数選択): Google Forms は複数選択の値を ", " で区切る
  // 1件でも ", " を含む値があれば checkbox（「、」は択一選択肢の文章に含まれる場合があるので除外）
  const hasMulti = nonEmpty.some((v) => String(v).includes(", "));
  if (hasMulti) return "checkbox";

  // 平均文字数が長い → 記述式（テキスト）
  const avgLen = nonEmpty.reduce((sum, v) => sum + String(v).length, 0) / nonEmpty.length;
  if (avgLen > 15) return "text";

  // Categorical (択一選択): 値の種類が少なく繰り返しが多い
  const unique = new Set(nonEmpty.map(String));
  if (unique.size <= 8 && unique.size / nonEmpty.length <= 0.5) return "categorical";

  return "text";
}

function PieChart({ slices }: { slices: { pct: number; color: string }[] }) {
  const cx = 90, cy = 90, r = 80;
  const active = slices.filter((s) => s.pct > 0);
  if (active.length === 1) {
    return (
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={cx} cy={cy} r={r} fill={active[0].color} />
      </svg>
    );
  }
  let angle = -Math.PI / 2;
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      {active.map((s, i) => {
        const sweep = (s.pct / 100) * 2 * Math.PI;
        const end = angle + sweep;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        const large = sweep > Math.PI ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        angle = end;
        return <path key={i} d={d} fill={s.color} stroke="white" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function QuestionCard({ header, children, count }: { header: string; children: React.ReactNode; count: number }) {
  return (
    <div className="border border-gray-100 rounded-xl p-5">
      <p className="text-base font-medium text-gray-800 mb-0.5">{header}</p>
      <p className="text-xs text-gray-400 mb-4">{count} 件の回答</p>
      {children}
    </div>
  );
}

export function SurveySection({ sheetId, onCountLoaded }: { sheetId: string; onCountLoaded?: (n: number) => void }) {
  const [rows, setRows] = useState<SurveyRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gasUrl = import.meta.env.VITE_SURVEY_GAS_URL;

  useEffect(() => {
    const id = extractSheetId(sheetId);
    if (!id || !gasUrl) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch(`${gasUrl}?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data);
        setLoading(false);
        if (Array.isArray(data) && data.length >= 2) onCountLoaded?.(data.length - 1);
      })
      .catch(() => { setError("データの取得に失敗しました"); setLoading(false); });
  }, [sheetId, gasUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gasUrl) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-2">アンケート集計</h2>
      <p className="text-sm text-gray-400">VITE_SURVEY_GAS_URL が未設定です</p>
    </div>
  );
  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-2">アンケート集計</h2>
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );
  if (error) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-2">アンケート集計</h2>
      <p className="text-sm text-red-400">{error}</p>
    </div>
  );
  if (!rows || rows.length < 2) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-2">アンケート集計</h2>
      <p className="text-sm text-gray-400">回答がまだありません</p>
    </div>
  );

  const headers = rows[0] as string[];
  const dataRows = rows.slice(1);
  const responseCount = dataRows.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-1">
        アンケート集計
        <span className="text-sm font-normal text-gray-400 ml-2">{responseCount} 件の回答</span>
      </h2>
      <div className="space-y-4 mt-4">
        {headers.slice(1).map((header, colIdx) => {
          const i = colIdx + 1;
          const values = dataRows.map((r) => r[i]).filter((v) => v !== "" && v !== null && v !== undefined);
          if (values.length === 0) return null;
          const type = detectColType(values);

          if (type === "numeric") {
            const nums = values.map(Number);
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
            const counts: Record<number, number> = {};
            nums.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0]));
            const max = Math.max(...Object.values(counts));
            return (
              <QuestionCard key={i} header={header} count={values.length}>
                <p className="text-3xl font-bold text-gray-800 mb-4">
                  {avg.toFixed(1)}
                  <span className="text-base font-normal text-gray-400 ml-1">平均</span>
                </p>
                <div className="space-y-2">
                  {sorted.map(([val, cnt]) => {
                    const pct = Math.round((cnt / values.length) * 100);
                    return (
                      <div key={val} className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 w-6 text-right flex-shrink-0">{val}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                          <div className="h-3 rounded-full" style={{ width: `${(cnt / max) * 100}%`, backgroundColor: CHART_COLORS[0] }} />
                        </div>
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">{cnt} 件 ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </QuestionCard>
            );
          }

          if (type === "categorical") {
            const counts: Record<string, number> = {};
            values.forEach((v) => { const k = String(v); counts[k] = (counts[k] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const slices = sorted.map((_, idx) => ({
              pct: (sorted[idx][1] / values.length) * 100,
              color: CHART_COLORS[idx % CHART_COLORS.length],
            }));
            return (
              <QuestionCard key={i} header={header} count={values.length}>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <PieChart slices={slices} />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    {sorted.map(([val, cnt], idx) => {
                      const pct = Math.round((cnt / values.length) * 100);
                      return (
                        <div key={val} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                          <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{val}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">{cnt} 件</span>
                          <span className="text-xs text-gray-400 flex-shrink-0 w-10 text-right">({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </QuestionCard>
            );
          }

          if (type === "checkbox") {
            const counts: Record<string, number> = {};
            values.forEach((v) => {
              String(v).split(", ").forEach((opt) => {
                const k = opt.trim();
                if (k) counts[k] = (counts[k] || 0) + 1;
              });
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const max = Math.max(...Object.values(counts));
            return (
              <QuestionCard key={i} header={header} count={values.length}>
                <div className="space-y-2">
                  {sorted.map(([val, cnt], idx) => {
                    const pct = Math.round((cnt / values.length) * 100);
                    return (
                      <div key={val}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            <span className="text-gray-700 truncate max-w-xs">{val}</span>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{cnt} 件 ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 ml-5">
                          <div className="h-3 rounded-full" style={{ width: `${(cnt / max) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </QuestionCard>
            );
          }

          return (
            <QuestionCard key={i} header={header} count={values.length}>
              <div className="space-y-2">
                {values.map((v, j) => (
                  <p key={j} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-snug">
                    {String(v)}
                  </p>
                ))}
              </div>
            </QuestionCard>
          );
        })}
      </div>
    </div>
  );
}
