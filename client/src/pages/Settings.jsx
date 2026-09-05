import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../api/AuthContext.jsx';
import SettingField from '../components/settings/SettingField.jsx';
import LedDevicesPanel from '../components/settings/LedDevicesPanel.jsx';
import UsersPanel from '../components/settings/UsersPanel.jsx';

const EVENT_SETTINGS = ['EventId', 'EventName'];
const SHAREPOINT_SETTINGS = [
  'SharePointSourceLocation',
  'AzureAdTenantId',
  'AzureAdClientId',
  'SharePointSiteId',
  'SharePointDriveId',
  'SharePointFolderId'
];
const FOLDER_SETTINGS = ['LocalDownloadFolder', 'RenamedAssetsFolder', 'DefaultAssetFolder', 'RunningOrderFile'];

const TABS = ['Event', 'SharePoint', 'Folders', 'LED Devices', 'LED Requirements', 'Users'];

export default function Settings() {
  const { user } = useAuth();
  const canEdit = user.role === 'SuperAdmin';
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('Event');

  async function load() {
    const { data } = await api.get('/settings/status');
    setStatus(data);
  }

  useEffect(() => {
    load();
  }, []);

  if (!status) return <p className="text-sm text-text-secondary">Loading…</p>;

  const byName = Object.fromEntries(status.settings.map((s) => [s.settingName, s]));
  const visibleTabs = canEdit ? TABS : TABS.filter((t) => t !== 'Users');

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {visibleTabs.map((t) => (
          <button
            key={t}
            className={`rounded-t-lg px-3 py-2 text-sm ${
              tab === t ? 'border-b-2 border-accent text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {!status.isReady && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Configuration is not complete: {status.missingRequiredSettings.length} required setting(s) missing,
          {status.enabledDeviceCount === 0 ? ' no LED device enabled,' : ''}
          {!status.ledRequirementsImported ? ' LED requirements not imported.' : ''}
        </div>
      )}

      {tab === 'Event' &&
        EVENT_SETTINGS.map((name) => (
          <SettingField key={name} setting={byName[name]} canEdit={canEdit} onSaved={load} />
        ))}

      {tab === 'SharePoint' && (
        <>
          {SHAREPOINT_SETTINGS.map((name) => (
            <SettingField key={name} setting={byName[name]} canEdit={canEdit} onSaved={load} />
          ))}
          <p className="mt-2 text-xs text-text-muted">
            Sign-in and Test Connection are implemented in Stage 5 (SharePoint authentication and discovery).
          </p>
        </>
      )}

      {tab === 'Folders' &&
        FOLDER_SETTINGS.map((name) => (
          <SettingField key={name} setting={byName[name]} canEdit={canEdit} onSaved={load} />
        ))}

      {tab === 'LED Devices' && (
        <LedDevicesPanel devices={status.devices} canEdit={canEdit} onChanged={load} />
      )}

      {tab === 'LED Requirements' && (
        <p className="text-sm text-text-secondary">
          {status.ledRequirementsImported
            ? `${status.ledRequirementsCount} requirement(s) imported.`
            : 'Not imported yet.'}{' '}
          Import/re-import from LED_File_Requirements.csv is implemented in Stage 4.
        </p>
      )}

      {tab === 'Users' && canEdit && <UsersPanel />}
    </div>
  );
}
