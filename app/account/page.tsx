'use client'

import { useEffect, useState } from 'react'
import { requireAuth } from '@/lib/auth'

interface Credits {
  total?: number
  subscription?: number
  onDemand?: number
  error?: string
}

export default function AccountPage() {
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCredits()
  }, [])

  const fetchCredits = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/fashn/credits')
      const data = await response.json()
      
      if (response.ok) {
        setCredits(data)
        if (data.error) {
          setError(data.error)
        }
      } else {
        setError(data.error || 'Failed to fetch credits')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch credits')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Account</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">FASHN AI Credits</h2>
        
        {loading && (
          <div className="text-gray-600">Loading credits...</div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {!loading && !error && credits && (
          <div className="space-y-4">
            {credits.total !== undefined && (
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700 font-medium">Total Credits:</span>
                <span className="text-gray-900 font-semibold text-lg">{credits.total.toLocaleString()}</span>
              </div>
            )}
            
            {credits.subscription !== undefined && (
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700 font-medium">Subscription Credits:</span>
                <span className="text-gray-900">{credits.subscription.toLocaleString()}</span>
              </div>
            )}
            
            {credits.onDemand !== undefined && (
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700 font-medium">On-Demand Credits:</span>
                <span className="text-gray-900">{credits.onDemand.toLocaleString()}</span>
              </div>
            )}

            {credits.total === undefined && credits.subscription === undefined && credits.onDemand === undefined && (
              <div className="text-gray-600">
                No credit information available. The FASHN provider may not be active, or the API response format may have changed.
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> Monthly usage tracking is not provided by the FASHN API. 
            To track usage over time, we would need to implement our own tracking system.
          </p>
        </div>

        <button
          onClick={fetchCredits}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Refresh Credits
        </button>
      </div>
    </div>
  )
}

