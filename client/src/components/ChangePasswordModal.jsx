import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../api/AuthContext.jsx';

export default function ChangePasswordModal({ onDone }) {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refresh();
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="card w-96 p-6">
        <div className="card-title mb-2">Change your password</div>
        <p className="mb-4 text-xs text-text-secondary">
          This account is using a temporary or default password and must set a new one before continuing.
        </p>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <label className="mb-1 block text-xs text-text-secondary">Current password</label>
        <input
          className="input-field mb-3"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <label className="mb-1 block text-xs text-text-secondary">New password (min 8 characters)</label>
        <input
          className="input-field mb-4"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
          {submitting ? 'Saving…' : 'Set new password'}
        </button>
        <button type="button" className="mt-2 w-full text-center text-xs text-text-muted hover:underline" onClick={() => onDone?.()}>
          Remind me later
        </button>
      </form>
    </div>
  );
}
