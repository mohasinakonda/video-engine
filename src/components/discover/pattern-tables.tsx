import { FORMAT_LABELS, MECHANISM_LABELS, type MarketPatterns } from './types';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Which formats and title styles the standout videos use, against all their videos and yours. */
export function PatternTables({ patterns }: { patterns: MarketPatterns }) {
  const formats = [...patterns.formats].sort((a, b) => b.competitorOutliers - a.competitorOutliers || b.competitorVideos - a.competitorVideos);
  const mechanisms = [...patterns.mechanisms].sort((a, b) => b.outlierShare - a.outlierShare || b.competitorShare - a.competitorShare);
  const smallSample = patterns.outliers < 5;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Formats and title styles</h3>
        <p className="text-sm text-zinc-400 mt-0.5">
          Based on {patterns.competitorVideos} competitor videos ({patterns.outliers} standouts) and your {patterns.yourVideos}.
          {patterns.aiClassified > 0 && ` Formats come from title patterns; ${patterns.aiClassified} were placed by AI.`}
          {patterns.unclassified > 0 && ` ${patterns.unclassified} had no clear format.`}
        </p>
        {smallSample && (
          <p className="text-sm text-amber-300 mt-1">Only {patterns.outliers} standout videos: treat the “standouts” column as an early signal, not a pattern.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Table
          title="Formats"
          head={['Their videos', 'Standouts', 'Yours']}
          rows={formats.map((f) => ({ key: f.format, label: FORMAT_LABELS[f.format], cells: [f.competitorVideos, f.competitorOutliers, f.yourVideos].map(String) }))}
        />
        <Table
          title="Title styles"
          head={['Standouts', 'All theirs', 'Yours']}
          rows={mechanisms.map((m) => ({ key: m.mechanism, label: MECHANISM_LABELS[m.mechanism], cells: [m.outlierShare, m.competitorShare, m.yourShare].map(pct) }))}
        />
      </div>
    </section>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: { key: string; label: string; cells: string[] }[] }) {
  return (
    <div className="rounded-2xl border border-bg-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-elevated">
            <th className="text-left font-semibold text-white p-3">{title}</th>
            {head.map((h) => (
              <th key={h} className="text-right font-medium text-zinc-400 p-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length + 1} className="p-3 text-zinc-500">
                Not enough data.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} className="border-t border-bg-border">
                <th scope="row" className="text-left font-normal text-zinc-200 p-3">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="text-right text-zinc-200 p-3 tabular-nums">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
