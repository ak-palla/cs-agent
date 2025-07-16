'use client';

import PlatformConnector from './PlatformConnector';

export default function TrelloEmbed() {
  const url = process.env.NEXT_PUBLIC_TRELLO_URL || 'https://trello.com/b/your-board-id';
  
  return (
    <PlatformConnector
      platform="trello"
      title="Trello Connection"
      description="Connect to your Trello board to manage cards and lists"
      url={url}
    />
  );
}