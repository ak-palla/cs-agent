'use client';

import TrelloEmbed from '@/components/TrelloEmbed';

export default function TrelloPage() {
  return (
    <div className="h-full bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Trello</h1>
        <p className="text-sm text-gray-600">Manage your Trello boards</p>
      </div>
      <TrelloEmbed />
    </div>
  );
}