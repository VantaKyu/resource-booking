import { useState } from 'react';
import { changePassword } from '../../lib/api';

export function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPass !== confirm) {
      setError('New passwords do not match');
      return;
    }

    if (newPass.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword: current, newPassword: newPass });
      alert('Password changed successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change Password</h2>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm">Current Password</span>
            <input
              type="password"
              className="w-full border rounded-lg p-2"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">New Password</span>
            <input
              type="password"
              className="w-full border rounded-lg p-2"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Confirm New Password</span>
            <input
              type="password"
              className="w-full border rounded-lg p-2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 text-white px-3 py-2 disabled:opacity-50"
            >
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
