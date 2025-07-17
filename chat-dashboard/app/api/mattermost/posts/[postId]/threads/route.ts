import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{
    postId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { postId } = await params;
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Get thread replies for a post
    const response = await fetch(`${baseUrl}/api/v4/posts/${postId}/thread`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost thread API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch thread', details: errorText },
        { status: response.status }
      );
    }

    const thread = await response.json();
    return NextResponse.json(thread);

  } catch (error) {
    console.error('Thread API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { postId } = await params;
    const { message, channel_id } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!message || !channel_id) {
      return NextResponse.json(
        { error: 'Message and channel ID required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Create reply in thread
    const response = await fetch(`${baseUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id,
        message,
        root_id: postId, // This makes it a reply to the original post
        parent_id: postId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost create reply API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create reply', details: errorText },
        { status: response.status }
      );
    }

    const reply = await response.json();
    return NextResponse.json(reply);

  } catch (error) {
    console.error('Create reply API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { postId } = await params;
    const { message } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Update post/reply
    const response = await fetch(`${baseUrl}/api/v4/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: postId,
        message
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost update post API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update post', details: errorText },
        { status: response.status }
      );
    }

    const updatedPost = await response.json();
    return NextResponse.json(updatedPost);

  } catch (error) {
    console.error('Update post API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { postId } = await params;
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Delete post/reply
    const response = await fetch(`${baseUrl}/api/v4/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost delete post API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to delete post', details: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete post API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 