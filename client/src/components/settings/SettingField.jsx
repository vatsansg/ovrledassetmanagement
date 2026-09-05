import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { api } from '../../api/client.js';

export default function SettingField({ setting, canEdit, onSaved }) {
  const [value, setValue] = useState(setting.value ?? '');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error

  async function handleBlur() {
    if (!canEdit || setting.isSensitive) return;
    if (value === (setting.value ?? '')) return;
    setSaveState('saving');
    try {
      await api.put(`/settings/${setting.settingName}`, { value });
      setSaveState('saved');
      onSaved?.();
      setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
    }
  }

  return (
    <div className="mb-3">
      <label className="mb-1 flex items-center gap-1 text-xs text-text-secondary">
        {setting.settingName}
        {setting.isRequired && <span className="text-danger">*</span>}
        {setting.isMissing && <AlertCircle size={12} className="text-warning" />}
        {saveState === 'saved' && <Check size={12} className="text-success" />}
      </label>
      <input
        className="input-field"
        value={setting.isSensitive ? value : value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={!canEdit || setting.isSensitive}
        placeholder={setting.isSensitive ? 'Resolved automatically' : ''}
      />
      {setting.description && <p className="mt-1 text-xs text-text-muted">{setting.description}</p>}
      {saveState === 'error' && <p className="mt-1 text-xs text-danger">Could not save</p>}
    </div>
  );
}
