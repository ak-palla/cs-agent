'use client';

import FlockEmbed from '@/components/FlockEmbed';

export default function FlockPage() {
  return (
    <div className="h-full bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Flock</h1>
        <p className="text-sm text-gray-600">Access your Flock workspace</p>
      </div>
      <FlockEmbed />
    </div>
  );
}