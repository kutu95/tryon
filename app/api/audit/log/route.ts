import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

/**
 * API endpoint for client-side audit logging (e.g., login attempts)
 * This allows the frontend to log events that happen client-side
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const metadata = getRequestMetadata(request)
    
    await logAuditEvent({
      ...body,
      ...metadata,
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Audit Log API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

