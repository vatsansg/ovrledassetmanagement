import { useState } from 'react';
import { api } from '../../api/client.js';

const STATUS_STYLE = {
  UNTESTED: 'status-unknown',
  PASS: 'status-up',
  FAIL: 'status-down'
};

export default function LedDevicesPanel({ devices, canEdit, onChanged }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(devices.map((d) => [d.deviceKey, { displayLabel: d.displayLabel, targetPath: d.targetPath || '' }]))
  );
  const [savingKey, setSavingKey] = useState(null);
  const [errorKey, setErrorKey] = useState(null);

  function updateDraft(deviceKey, patch) {
    setDrafts((prev) => ({ ...prev, [deviceKey]: { ...prev[deviceKey], ...patch } }));
  }

  async function saveDevice(deviceKey, patch) {
    setSavingKey(deviceKey);
    setErrorKey(null);
    try {
      await api.put(`/led-devices/${deviceKey}`, { ...drafts[deviceKey], ...patch });
      onChanged?.();
    } catch {
      setErrorKey(deviceKey);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="py-2 pr-3">Device</th>
            <th className="py-2 pr-3">Label</th>
            <th className="py-2 pr-3">Resolution</th>
            <th className="py-2 pr-3">Target path</th>
            <th className="py-2 pr-3">Enabled</th>
            <th className="py-2 pr-3">Connection</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.deviceKey} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 font-mono">{d.deviceKey}</td>
              <td className="py-2 pr-3">
                <input
                  className="input-field !py-1"
                  value={drafts[d.deviceKey].displayLabel}
                  disabled={!canEdit}
                  onChange={(e) => updateDraft(d.deviceKey, { displayLabel: e.target.value })}
                  onBlur={() => saveDevice(d.deviceKey, {})}
                />
              </td>
              <td className="py-2 pr-3 font-mono text-text-secondary">
                {d.resolutionWidth}×{d.resolutionHeight}
              </td>
              <td className="py-2 pr-3">
                <input
                  className="input-field !py-1"
                  placeholder="e.g. L:\\"
                  value={drafts[d.deviceKey].targetPath}
                  disabled={!canEdit}
                  onChange={(e) => updateDraft(d.deviceKey, { targetPath: e.target.value })}
                  onBlur={() => saveDevice(d.deviceKey, {})}
                />
              </td>
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  disabled={!canEdit}
                  onChange={(e) => saveDevice(d.deviceKey, { enabled: e.target.checked })}
                />
              </td>
              <td className="py-2 pr-3">
                <span className={STATUS_STYLE[d.lastConnectionStatus] || 'status-unknown'}>
                  {d.lastConnectionStatus === 'UNTESTED' || !d.lastConnectionStatus
                    ? 'Not tested (Stage 13)'
                    : d.lastConnectionStatus}
                </span>
                {savingKey === d.deviceKey && <span className="ml-2 text-xs text-text-muted">Saving…</span>}
                {errorKey === d.deviceKey && <span className="ml-2 text-xs text-danger">Save failed</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
