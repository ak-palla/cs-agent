import { NextRequest, NextResponse } from 'next/server';
import { serverWorkflowTriggerManager } from '@/lib/server-workflow-trigger-manager';

/**
 * POST /api/admin/triggers/init
 * Initialize sample workflow triggers for demonstration
 */
export async function POST(request: NextRequest) {
  try {
    await serverWorkflowTriggerManager.createSampleTriggers();

    return NextResponse.json({
      success: true,
      message: 'Sample workflow triggers created successfully'
    });

  } catch (error) {
    console.error('Error creating sample triggers:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create sample triggers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}