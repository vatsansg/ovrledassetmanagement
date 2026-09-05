import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';

function FolderHintInput({ requirement, canEdit, onSaved }) {
  const [value, setValue] = useState(requirement.SourceFolderHint || '');

  async function handleBlur() {
    if (!canEdit || value === (requirement.SourceFolderHint || '')) return;
    await api.patch(`/led-requirements/${requirement.Id}/folder-hint`, { sourceFolderHint: value || null });
    onSaved?.();
  }

  return (
    <input
      className="input-field !py-1 font-mono"
      value={value}
      disabled={!canEdit}
      placeholder="e.g. 5_Game_Point"
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

export default function LedRequirementsPanel({ canEdit, onChanged }) {
  const fileInputRef = useRef(null);
  const [requirements, setRequirements] = useState([]);
  const [csvContent, setCsvContent] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await api.get('/led-requirements');
    setRequirements(data);
  }

  useEffect(() => {
    load();
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCsvContent(reader.result);
    reader.readAsText(file);
  }

  async function handlePreview() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/led-requirements/preview-import', { csvContent });
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not parse CSV');
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/led-requirements/apply-import', { csvContent });
      setPreview(null);
      setCsvContent(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-4 rounded-lg border border-border p-3">
          <label className="mb-2 block text-xs text-text-secondary">
            Import / re-import from LED_File_Requirements.csv
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" />
            <button className="btn-secondary" disabled={!csvContent || busy} onClick={handlePreview}>
              Preview changes
            </button>
          </div>
          {fileName && <p className="mt-1 text-xs text-text-muted">Selected: {fileName}</p>}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          {preview && (
            <div className="mt-3 rounded-lg border border-border p-3 text-sm">
              <p className="mb-2 font-medium">
                {preview.toAdd.length} new, {preview.toUpdate.length} changed, {preview.toDeactivate.length}{' '}
                to deactivate, {preview.unchanged.length} unchanged
                {preview.skipped.length > 0 && `, ${preview.skipped.length} row(s) skipped (unrecognized)`}
              </p>
              {preview.toUpdate.length > 0 && (
                <ul className="mb-2 list-inside list-disc text-xs text-warning">
                  {preview.toUpdate.map((u) => (
                    <li key={u.canonicalFilename}>{u.canonicalFilename} — fields changed</li>
                  ))}
                </ul>
              )}
              {preview.toDeactivate.length > 0 && (
                <ul className="mb-2 list-inside list-disc text-xs text-danger">
                  {preview.toDeactivate.map((name) => (
                    <li key={name}>{name} — will be deactivated (missing from new CSV)</li>
                  ))}
                </ul>
              )}
              <button className="btn-primary" disabled={busy} onClick={handleApply}>
                Apply import
              </button>
            </div>
          )}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="py-2 pr-3">Canonical filename</th>
            <th className="py-2 pr-3">Required?</th>
            <th className="py-2 pr-3">Fallback</th>
            <th className="py-2 pr-3">Persistent</th>
            <th className="py-2 pr-3">Source folder hint</th>
            <th className="py-2 pr-3">Description</th>
            <th className="py-2 pr-3">Active</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((r) => (
            <tr key={r.Id} className={`border-b border-border last:border-0 ${!r.IsActive ? 'opacity-50' : ''}`}>
              <td className="py-2 pr-3 font-mono">{r.CanonicalFilename}</td>
              <td className="py-2 pr-3">{r.RequiredOrOptional}</td>
              <td className="py-2 pr-3 font-mono text-text-secondary">{r.FallbackFilename || '—'}</td>
              <td className="py-2 pr-3">{r.IsPersistentAsset ? 'Yes' : ''}</td>
              <td className="py-2 pr-3">
                <FolderHintInput requirement={r} canEdit={canEdit} onSaved={load} />
              </td>
              <td className="py-2 pr-3 text-text-secondary">{r.Description}</td>
              <td className="py-2 pr-3">{r.IsActive ? 'Yes' : 'No'}</td>
            </tr>
          ))}
          {requirements.length === 0 && (
            <tr>
              <td colSpan={7} className="py-3 text-text-muted">
                Not imported yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
