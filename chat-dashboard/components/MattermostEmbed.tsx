'use client';

import PlatformConnector from './PlatformConnector';

export default function MattermostEmbed() {
  const url = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://your-mattermost-instance.com';
  
  return (
    <PlatformConnector
      platform="mattermost"
      title="Mattermost Connection"
      description="Connect to your Mattermost workspace to view messages and channels"
      url={url}
    />
  );
}