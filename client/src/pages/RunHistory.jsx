import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import RunSummary from '../components/processing/RunSummary.jsx';
import AssetTable from '../components/processing/AssetTable.jsx';
import ValidationErrorsTable from '../components/processing/ValidationErrorsTable.jsx';
import SequencePreview from '../components/processing/SequencePreview.jsx';

export default function RunHistory() {
  const [runs, setRuns] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get('/runs').then(({ data }) => setRuns(data));
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    api.get(`/runs/${selectedRunId}`).then(({ data }) => setDetail(data));
  }, [selectedRunId]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="card-title mb-3">Run History</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary">
              <th className="py-2 pr-3">Run</th>
              <th className="py-2 pr-3">Event</th>
              <th className="py-2 pr-3">Started</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(runs || []).map((r) => (
              <tr
                key={r.RunId}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-hover"
                onClick={() => setSelectedRunId(r.RunId)}
              >
                <td className="py-2 pr-3 font-mono text-xs">{r.RunId.slice(0, 8)}</td>
                <td className="py-2 pr-3">{r.EventId}</td>
                <td className="py-2 pr-3 font-mono text-text-secondary">{r.StartTime}</td>
                <td className="py-2 pr-3">{r.Status}</td>
              </tr>
            ))}
            {runs && runs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-text-muted">
                  No runs yet.
                </td>
              </tr>
            )}
            {!runs && (
              <tr>
                <td colSpan={4} className="py-3 text-text-secondary">
                  Not available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <>
          <RunSummary
            run={detail.run}
            files={detail.files}
            renamedAssets={detail.renamedAssets}
            distributionResults={detail.distributionResults}
          />
          <ValidationErrorsTable files={detail.files} validationResults={detail.validationResults} />
          <SequencePreview sequenceEntries={detail.sequenceEntries} runId={detail.run.RunId} />
          <AssetTable files={detail.files} />
        </>
      )}
    </div>
  );
}
