import { NextRequest, NextResponse } from 'next/server';
import { serverWorkflowTriggerManager, WorkflowTrigger } from '@/lib/server-workflow-trigger-manager';

/**
 * GET /api/admin/triggers
 * Fetch all workflow triggers with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as any;
    const enabled = searchParams.get('enabled');

    const triggers = await serverWorkflowTriggerManager.getTriggers(
      platform || undefined,
      enabled !== null ? enabled === 'true' : undefined
    );

    return NextResponse.json({
      success: true,
      data: triggers,
      count: triggers.length
    });

  } catch (error) {
    console.error('Error fetching triggers:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch triggers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/triggers
 * Create a new workflow trigger
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'platform', 'event_type', 'conditions', 'ai_agent_config'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { 
            success: false,
            error: `Missing required field: ${field}`
          },
          { status: 400 }
        );
      }
    }

    const trigger = await serverWorkflowTriggerManager.createTrigger(body);

    if (!trigger) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create trigger'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trigger,
      message: 'Trigger created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating trigger:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}