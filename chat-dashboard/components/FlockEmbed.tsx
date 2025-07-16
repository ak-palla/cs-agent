'use client';

import PlatformConnector from './PlatformConnector';

export default function FlockEmbed() {
  const url = process.env.NEXT_PUBLIC_FLOCK_URL || 'https://web.flock.com';
  
  return (
    <PlatformConnector
      platform="flock"
      title="Flock Connection"
      description="Connect to your Flock workspace to access team communications"
      url={url}
    />
  );
}