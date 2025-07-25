import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const env = {
    // Trello variables
    NEXT_PUBLIC_TRELLO_API_KEY: process.env.NEXT_PUBLIC_TRELLO_API_KEY,
    TRELLO_API_SECRET: process.env.TRELLO_API_SECRET,
    NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI,
    
    // Mattermost variables for comparison
    NEXT_PUBLIC_MATTERMOST_CLIENT_ID: process.env.NEXT_PUBLIC_MATTERMOST_CLIENT_ID,
    MATTERMOST_CLIENT_SECRET: process.env.MATTERMOST_CLIENT_SECRET,
    NEXT_PUBLIC_MATTERMOST_URL: process.env.NEXT_PUBLIC_MATTERMOST_URL,
    NEXT_PUBLIC_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
    
    // All process.env keys
    allKeys: Object.keys(process.env),
    
    // Check if we're in server or client context
    isServer: typeof window === 'undefined',
    nodeEnv: process.env.NODE_ENV,
  };
  
  // Mask sensitive values
  const maskedEnv = {
    ...env,
    TRELLO_API_SECRET: env.TRELLO_API_SECRET ? '***SET***' : '***MISSING***',
    MATTERMOST_CLIENT_SECRET: env.MATTERMOST_CLIENT_SECRET ? '***SET***' : '***MISSING***',
    NEXT_PUBLIC_TRELLO_API_KEY: env.NEXT_PUBLIC_TRELLO_API_KEY ? '***SET***' : '***MISSING***',
    NEXT_PUBLIC_MATTERMOST_CLIENT_ID: env.NEXT_PUBLIC_MATTERMOST_CLIENT_ID ? '***SET***' : '***MISSING***',
  };
  
  return NextResponse.json(maskedEnv);
}