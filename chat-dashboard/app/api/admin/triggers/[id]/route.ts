import { NextRequest, NextResponse } from 'next/server';
import { serverWorkflowTriggerManager } from '@/lib/server-workflow-trigger-manager';

/**
 * PATCH /api/admin/triggers/[id]
 * Update a workflow trigger
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const triggerId = params.id;

    const updatedTrigger = await serverWorkflowTriggerManager.updateTrigger(triggerId, body);

    if (!updatedTrigger) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update trigger or trigger not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTrigger,
      message: 'Trigger updated successfully'
    });

  } catch (error) {
    console.error('Error updating trigger:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/triggers/[id]
 * Delete a workflow trigger
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const triggerId = params.id;

    const success = await serverWorkflowTriggerManager.deleteTrigger(triggerId);

    if (!success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to delete trigger or trigger not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Trigger deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting trigger:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/triggers/[id]/toggle
 * Toggle trigger enabled/disabled status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const triggerId = params.id;

    const updatedTrigger = await serverWorkflowTriggerManager.toggleTrigger(triggerId);

    if (!updatedTrigger) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to toggle trigger or trigger not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTrigger,
      message: `Trigger ${updatedTrigger.enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Error toggling trigger:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to toggle trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}