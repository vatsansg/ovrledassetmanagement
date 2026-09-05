import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../api/AuthContext.jsx';

export default function UsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('Admin');
  const [revealedPassword, setRevealedPassword] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post('/users', { username: newUsername, role: newRole });
      setRevealedPassword({ username: data.username, password: data.temporaryPassword });
      setNewUsername('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user');
    }
  }

  async function toggleActive(u) {
    await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
    load();
  }

  async function changeRole(u, role) {
    await api.patch(`/users/${u.id}`, { role });
    load();
  }

  async function resetPassword(u) {
    const { data } = await api.post(`/users/${u.id}/reset-password`);
    setRevealedPassword({ username: u.username, password: data.temporaryPassword });
    load();
  }

  return (
    <div>
      {revealedPassword && (
        <div className="card mb-4 border-warning p-3 text-sm">
          Temporary password for <span className="font-mono">{revealedPassword.username}</span>:{' '}
          <span className="font-mono">{revealedPassword.password}</span> — shown once, share it securely.
          <button className="ml-3 text-xs underline" onClick={() => setRevealedPassword(null)}>
            Dismiss
          </button>
        </div>
      )}

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="py-2 pr-3">Username</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3">Active</th>
            <th className="py-2 pr-3">Last login</th>
            <th className="py-2 pr-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 font-mono">{u.username}</td>
              <td className="py-2 pr-3">
                <select
                  className="input-field !py-1"
                  value={u.role}
                  disabled={u.id === currentUser.id}
                  onChange={(e) => changeRole(u, e.target.value)}
                >
                  <option value="SuperAdmin">SuperAdmin</option>
                  <option value="Admin">Admin</option>
                </select>
              </td>
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={u.isActive}
                  disabled={u.id === currentUser.id}
                  onChange={() => toggleActive(u)}
                />
              </td>
              <td className="py-2 pr-3 font-mono text-text-secondary">{u.lastLoginAt || 'Never'}</td>
              <td className="py-2 pr-3">
                <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => resetPassword(u)}>
                  Reset password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={createUser} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-text-secondary">New username</label>
          <input className="input-field" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Role</label>
          <select className="input-field" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            <option value="Admin">Admin</option>
            <option value="SuperAdmin">SuperAdmin</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Add user
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
