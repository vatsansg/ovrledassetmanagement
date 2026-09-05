import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { subscribeToWs } from '../../api/ws.js';

const STEP_LABELS = {
  authentication: 'Authentication',
  site: 'SharePoint Site',
  library: 'Document Library',
  folder: 'Source Folder',
  fileListing: 'File Listing'
};

export default function SharePointPanel({ canEdit }) {
  const [status, setStatus] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  async function loadStatus() {
    const { data } = await api.get('/sharepoint/status');
    setStatus(data);
  }

  useEffect(() => {
    loadStatus();
    return subscribeToWs((msg) => {
      if (msg.type === 'sharepoint.signin.result') {
        setSigningIn(false);
        if (msg.payload.status === 'success') {
          loadStatus();
        } else {
          setError(msg.payload.message);
        }
      }
    });
  }, []);

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    await api.post('/sharepoint/signin');
    // resolution arrives over the WebSocket once the operator completes
    // sign-in in the system browser that was just opened
  }

  async function handleSignOut() {
    await api.post('/sharepoint/signout');
    setTestResult(null);
    loadStatus();
  }

  async function handleTestConnection() {
    setTesting(true);
    setError(null);
    try {
      const { data } = await api.post('/sharepoint/test-connection');
      setTestResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Test connection failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-border p-3">
      <div className="mb-2 text-sm font-medium">Microsoft 365 sign-in</div>
      {status ? (
        <p className="mb-2 text-sm text-text-secondary">
          {status.signedIn ? (
            <>
              Signed in as <span className="font-mono">{status.username}</span>
            </>
          ) : (
            'Not signed in'
          )}
        </p>
      ) : (
        <p className="mb-2 text-sm text-text-secondary">Not available</p>
      )}

      {canEdit && (
        <div className="mb-2 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={handleSignIn} disabled={signingIn}>
            {signingIn ? 'Waiting for browser sign-in…' : status?.signedIn ? 'Sign in again' : 'Sign in'}
          </button>
          {status?.signedIn && (
            <button className="btn-secondary" onClick={handleSignOut}>
              Sign out
            </button>
          )}
          <button className="btn-secondary" onClick={handleTestConnection} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {testResult && (
        <div className="mt-2 space-y-1 text-sm">
          {Object.entries(STEP_LABELS).map(([key, label]) => {
            const step = testResult.steps[key];
            if (!step) return null;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={step.result === 'PASS' ? 'status-up' : 'status-down'}>{step.result}</span>
                <span className="text-text-secondary">{label}:</span>
                <span className="text-text-muted">{step.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
