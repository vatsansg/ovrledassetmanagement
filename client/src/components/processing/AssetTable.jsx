const STATUS_STYLE = {
  NEW: 'status-up',
  MODIFIED: 'status-warning',
  NO_CHANGE: 'status-unknown',
  INVALID: 'status-down',
  UNMATCHED: 'status-unknown'
};

export default function AssetTable({ files }) {
  return (
    <div className="card p-4">
      <div className="card-title mb-3">Discovered assets</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary">
              <th className="py-2 pr-3">Filename</th>
              <th className="py-2 pr-3">Device</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Validation</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Renamed to</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.Id} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 font-mono">{f.SourceFilename}</td>
                <td className="py-2 pr-3 font-mono text-text-secondary">{f.DetectedDeviceToken || '—'}</td>
                <td className="py-2 pr-3">{f.AssetCategory}</td>
                <td className={`py-2 pr-3 ${f.ValidationStatus === 'INVALID' ? 'status-down' : 'status-up'}`}>
                  {f.ValidationStatus || '—'}
                </td>
                <td className={`py-2 pr-3 ${STATUS_STYLE[f.FileStatus] || 'status-unknown'}`}>{f.FileStatus}</td>
                <td className="py-2 pr-3 font-mono text-text-secondary">{f.RenamedFilename || '—'}</td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-text-muted">
                  Not available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
