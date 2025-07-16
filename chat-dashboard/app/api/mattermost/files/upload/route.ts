import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const formData = await request.formData();
    
    const mattermostUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    const apiUrl = `${mattermostUrl}/api/v4/files`;
    
    // Forward the form data to Mattermost
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost file upload error:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload file', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}