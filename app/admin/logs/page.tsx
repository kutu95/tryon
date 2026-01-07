'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AuditLog {
  id: string
  user_id?: string
  event_type: string
  resource_type?: string
  resource_id?: string
  details?: any
  ip_address?: string
  user_agent?: string
  created_at: string
  user?: {
    id: string
    display_name?: string
    role?: string
  }
}

interface LogsResponse {
  logs: AuditLog[]
  total: number
  limit: number
  offset: number
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(100)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('')
  const [userIdFilter, setUserIdFilter] = useState<string>('')

  useEffect(() => {
    fetchLogs()
  }, [offset, eventTypeFilter, userIdFilter])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })
      if (eventTypeFilter) {
        params.append('event_type', eventTypeFilter)
      }
      if (userIdFilter) {
        params.append('user_id', userIdFilter)
      }

      const response = await fetch(`/api/admin/logs?${params.toString()}`)
      const data: LogsResponse = await response.json()
      
      if (response.ok) {
        setLogs(data.logs)
        setTotal(data.total)
      } else {
        console.error('Error fetching logs:', data)
        alert('Failed to fetch logs. You may not have admin access.')
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
      alert('Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  const getEventTypeColor = (eventType: string) => {
    if (eventType.includes('created')) return 'bg-green-100 text-green-800'
    if (eventType.includes('deleted')) return 'bg-red-100 text-red-800'
    if (eventType.includes('updated')) return 'bg-blue-100 text-blue-800'
    if (eventType.includes('login')) return 'bg-purple-100 text-purple-800'
    if (eventType.includes('failure')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

      {/* Filters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value)
                setOffset(0) // Reset to first page when filter changes
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">All Events</option>
              <option value="login_attempt">Login Attempt</option>
              <option value="login_success">Login Success</option>
              <option value="login_failure">Login Failure</option>
              <option value="actor_created">Actor Created</option>
              <option value="actor_deleted">Actor Deleted</option>
              <option value="garment_created">Garment Created</option>
              <option value="garment_deleted">Garment Deleted</option>
              <option value="look_board_created">Look Board Created</option>
              <option value="look_board_deleted">Look Board Deleted</option>
              <option value="look_item_deleted">Look Item Deleted</option>
              <option value="tryon_created">Try-on Created</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID (optional)
            </label>
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value)
                setOffset(0)
              }}
              placeholder="Filter by user ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
          </div>
        </div>
        <div className="text-sm text-gray-600">
          Showing {logs.length} of {total} logs
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-8">Loading logs...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEventTypeColor(log.event_type)}`}>
                        {formatEventType(log.event_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user ? (
                        <div>
                          <div className="font-medium">{log.user.display_name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500 font-mono">{log.user_id?.substring(0, 8)}...</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.resource_type && (
                        <div>
                          <div className="font-medium">{log.resource_type}</div>
                          {log.resource_id && (
                            <div className="text-xs text-gray-500 font-mono">{log.resource_id.substring(0, 8)}...</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.details && (
                        <pre className="text-xs bg-gray-100 p-2 rounded max-w-md overflow-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {logs.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No logs found
        </div>
      )}
    </div>
  )
}

