import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';

export default function AdminGate() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/admin/resources');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Admin / Staff Sign In</h1>
          <p className="text-sm text-gray-600">
            Enter your credentials to access the Resource Manager.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Username</span>
            <input
              type="text"
              className="mt-1 w-full border rounded-lg p-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Password</span>
            <input
              type="password"
              className="mt-1 w-full border rounded-lg p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-xs text-gray-500 border-t pt-3">
          Default credentials: <code className="px-1 py-0.5 bg-gray-100 rounded">admin / admin123</code>
        </div>
      </div>
    </div>
  );
}
