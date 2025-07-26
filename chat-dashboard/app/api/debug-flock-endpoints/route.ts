import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_FLOCK_URL || 'https://api.flock.com';
  const clientId = process.env.NEXT_PUBLIC_FLOCK_CLIENT_ID;
  
  const endpoints = [
    `${baseUrl}/oauth/authorize`,
    `${baseUrl}/oauth/token`,
    `${baseUrl}/v1/oauth/authorize`,
    `${baseUrl}/v1/oauth/token`,
    `${baseUrl}/oauth/v2/authorize`,
    `${baseUrl}/oauth/v2/token`,
    `${baseUrl}/users.getInfo`,
    `${baseUrl}/v1/users.getInfo`,
  ];

  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        return {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        };
      } catch (error) {
        return {
          endpoint,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return NextResponse.json({
    baseUrl,
    clientId: clientId ? '***SET***' : '***MISSING***',
    endpoints: results,
    recommended: {
      auth: `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=https://localhost:3000/auth/flock/callback&scope=chat:read chat:write`,
    },
  });
}