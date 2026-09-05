import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  useEffect(() => {
    api.get('/settings/status').then(({ data }) => setStatus(data));
    api.get('/runs').then(({ data }) => setLastRun(data[0] || null));
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="card p-4">
        <div className="card-title">Configuration status</div>
        {status ? (
          <p className={`mt-2 text-sm ${status.isReady ? 'status-up' : 'status-warning'}`}>
            {status.isReady ? 'Ready to run' : `${status.missingRequiredSettings.length} setting(s) missing`}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">Not available</p>
        )}
        <Link to="/settings" className="mt-2 inline-block text-xs text-accent hover:underline">
          Go to Settings
        </Link>
      </div>
      <div className="card p-4">
        <div className="card-title">LED devices enabled</div>
        <p className="mt-2 text-sm text-text-secondary">{status ? status.enabledDeviceCount : 'Not available'}</p>
      </div>
      <div className="card p-4">
        <div className="card-title">Last run</div>
        {lastRun ? (
          <>
            <p className="mt-2 text-sm">{lastRun.Status}</p>
            <p className="font-mono text-xs text-text-secondary">{lastRun.StartTime}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">Not available</p>
        )}
        <Link to="/processing" className="mt-2 inline-block text-xs text-accent hover:underline">
          Go to Processing
        </Link>
      </div>
    </div>
  );
}
