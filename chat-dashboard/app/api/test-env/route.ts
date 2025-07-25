// Test API route to check environment variables
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_TRELLO_API_KEY: process.env.NEXT_PUBLIC_TRELLO_API_KEY,
    TRELLO_API_SECRET: process.env.TRELLO_API_SECRET ? '***' : 'undefined',
    NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI,
  });
}