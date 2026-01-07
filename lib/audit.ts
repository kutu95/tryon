import { createAdminClient } from './supabase/admin'
import { NextRequest } from 'next/server'

export interface AuditLogEvent {
  user_id?: string
  event_type: string
  resource_type?: string
  resource_id?: string
  details?: Record<string, any>
  ip_address?: string
  user_agent?: string
}

/**
 * Log an audit event to the database
 * Uses admin client to bypass RLS and ensure logging always works
 */
export async function logAuditEvent(event: AuditLogEvent): Promise<void> {
  try {
    const adminSupabase = createAdminClient()
    
    const { error } = await adminSupabase
      .from('audit_log')
      .insert({
        user_id: event.user_id || null,
        event_type: event.event_type,
        resource_type: event.resource_type || null,
        resource_id: event.resource_id || null,
        details: event.details || null,
        ip_address: event.ip_address || null,
        user_agent: event.user_agent || null,
      })
    
    if (error) {
      console.error('[Audit Log] Failed to log event:', error)
      // Don't throw - we don't want logging failures to break the app
    }
  } catch (error) {
    console.error('[Audit Log] Error logging event:', error)
    // Don't throw - we don't want logging failures to break the app
  }
}

/**
 * Extract IP address and user agent from a Next.js request
 */
export function getRequestMetadata(request: NextRequest | Request): {
  ip_address?: string
  user_agent?: string
} {
  const headers = request.headers
  const ip = 
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    (request as any).ip ||
    undefined
  const userAgent = headers.get('user-agent') || undefined
  
  return {
    ip_address: ip,
    user_agent: userAgent,
  }
}

