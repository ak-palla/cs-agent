'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FlockConnectPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/flock/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (data.success) {
        router.push('/flock');
      } else {
        setError(data.message || 'Invalid token');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connect to Flock
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your Flock app token to connect
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleConnect}>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">
              Flock App Token
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Flock app token here"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect to Flock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}