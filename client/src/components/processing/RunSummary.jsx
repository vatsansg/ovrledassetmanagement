function Stat({ label, value, tone }) {
  return (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`text-lg font-semibold ${tone || ''}`}>{value}</div>
    </div>
  );
}

export default function RunSummary({ run, files, renamedAssets, distributionResults }) {
  if (!run) return null;

  const valid = files.filter((f) => f.ValidationStatus === 'VALID').length;
  const invalid = files.filter((f) => f.ValidationStatus === 'INVALID').length;
  const newCount = files.filter((f) => f.FileStatus === 'NEW').length;
  const modified = files.filter((f) => f.FileStatus === 'MODIFIED').length;
  const noChange = files.filter((f) => f.FileStatus === 'NO_CHANGE').length;
  const fallbacks = renamedAssets.filter((r) => r.IsFallbackUsed).length;
  const distributedByDevice = {};
  for (const d of distributionResults) {
    distributedByDevice[d.DeviceKey] ||= { verified: 0, failed: 0 };
    if (d.Status === 'VERIFIED') distributedByDevice[d.DeviceKey].verified += 1;
    else if (d.Status === 'FAILED') distributedByDevice[d.DeviceKey].failed += 1;
  }

  const statusTone = run.Status === 'FAILED' ? 'status-down' : run.Status?.includes('WARNING') ? 'status-warning' : 'status-up';

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="card-title">Run summary</div>
        <span className={`font-mono text-sm ${statusTone}`}>{run.Status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Valid" value={valid} tone="status-up" />
        <Stat label="Invalid" value={invalid} tone={invalid > 0 ? 'status-down' : ''} />
        <Stat label="New" value={newCount} />
        <Stat label="Modified" value={modified} />
        <Stat label="No change" value={noChange} />
        <Stat label="Fallbacks used" value={fallbacks} tone={fallbacks > 0 ? 'status-warning' : ''} />
      </div>
      {Object.keys(distributedByDevice).length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(distributedByDevice).map(([deviceKey, counts]) => (
            <div key={deviceKey} className="rounded-lg border border-border p-2 text-sm">
              <div className="font-mono">{deviceKey}</div>
              <div className="status-up">{counts.verified} distributed</div>
              {counts.failed > 0 && <div className="status-down">{counts.failed} failed</div>}
            </div>
          ))}
        </div>
      )}
      {run.ErrorSummary && <p className="mt-3 text-sm text-danger">{run.ErrorSummary}</p>}
    </div>
  );
}
