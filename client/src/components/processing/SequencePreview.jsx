export default function SequencePreview({ sequenceEntries, runId }) {
  if (!sequenceEntries || sequenceEntries.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="card-title">Sequence preview</div>
        <a className="btn-secondary text-xs" href={`/api/runs/${runId}/sequence-csv`}>
          Download CSV
        </a>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 border-b border-border bg-bg-card text-left text-xs text-text-secondary">
              <th className="py-2 pr-3">Target</th>
              <th className="py-2 pr-3">Sequence</th>
              <th className="py-2 pr-3">Filename</th>
            </tr>
          </thead>
          <tbody>
            {sequenceEntries.map((e) => (
              <tr key={e.Id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-3 font-mono">{e.DeviceKey}</td>
                <td className="py-1.5 pr-3 font-mono">{e.Sequence}</td>
                <td className="py-1.5 pr-3 font-mono">{e.Filename}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
