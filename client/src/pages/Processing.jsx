import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { subscribeToWs } from '../api/ws.js';
import { useAuth } from '../api/AuthContext.jsx';
import RunSummary from '../components/processing/RunSummary.jsx';
import AssetTable from '../components/processing/AssetTable.jsx';
import ValidationErrorsTable from '../components/processing/ValidationErrorsTable.jsx';
import SequencePreview from '../components/processing/SequencePreview.jsx';

export default function Processing() {
  const { user } = useAuth();
  const [preconditions, setPreconditions] = useState(null);
  const [running, setRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(null);
  const [error, setError] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [unmatched, setUnmatched] = useState(null);

  const loadPreconditions = useCallback(async () => {
    const { data } = await api.get('/runs/preconditions');
    setPreconditions(data);
  }, []);

  const loadLatestRun = useCallback(async () => {
    const { data } = await api.get('/runs');
    if (data.length > 0) {
      const { data: detail } = await api.get(`/runs/${data[0].RunId}`);
      setRunDetail(detail);
    }
  }, []);

  useEffect(() => {
    loadPreconditions();
    loadLatestRun();
    return subscribeToWs((msg) => {
      if (msg.type === 'run.progress') {
        setProgressStep(msg.payload.step);
        if (['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED'].includes(msg.payload.step)) {
          setRunning(false);
          setUnmatched(msg.payload.detail?.unmatched || null);
          api.get(`/runs/${msg.payload.runId}`).then(({ data }) => setRunDetail(data));
        }
      }
    });
  }, [loadPreconditions, loadLatestRun]);

  async function startRun() {
    setRunning(true);
    setError(null);
    setProgressStep('STARTING');
    try {
      await api.post('/runs');
    } catch (err) {
      setError(err.response?.data?.error || 'Run failed to start');
      setRunning(false);
    }
  }

  const canRun = preconditions?.ready && !running;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="card-title">LED Asset Processing</div>
            {preconditions && !preconditions.ready && (
              <ul className="mt-2 list-inside list-disc text-sm text-warning">
                {preconditions.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn-primary" onClick={startRun} disabled={!canRun}>
            {running ? `Running… (${progressStep || 'starting'})` : 'Start Run'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {runDetail && (
        <>
          <RunSummary
            run={runDetail.run}
            files={runDetail.files}
            renamedAssets={runDetail.renamedAssets}
            distributionResults={runDetail.distributionResults}
          />
          <ValidationErrorsTable files={runDetail.files} validationResults={runDetail.validationResults} />
          {unmatched && unmatched.length > 0 && (
            <div className="card p-4">
              <div className="card-title mb-3 text-warning">Excluded / unmatched files</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-secondary">
                    <th className="py-2 pr-3">File</th>
                    <th className="py-2 pr-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((u, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-mono">{u.file}</td>
                      <td className="py-2 pr-3 text-text-secondary">{u.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SequencePreview sequenceEntries={runDetail.sequenceEntries} runId={runDetail.run.RunId} />
          <AssetTable files={runDetail.files} />
        </>
      )}

      {!runDetail && !running && <p className="text-sm text-text-secondary">Not available</p>}
    </div>
  );
}
