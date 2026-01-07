'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FashnApiKey {
  apiKey: string
  hasKey: boolean
}

export default function AccountPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState<FashnApiKey | null>(null)
  const [isEditingApiKey, setIsEditingApiKey] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [confirmApiKey, setConfirmApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
    fetchApiKey()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchApiKey = async () => {
    try {
      const response = await fetch('/api/settings/fashn-api-key')
      if (response.ok) {
        const data = await response.json()
        setApiKey(data)
      }
    } catch (err) {
      console.error('Error fetching API key:', err)
    }
  }

  const handleSaveApiKey = async () => {
    if (newApiKey !== confirmApiKey) {
      setError('API keys do not match')
      return
    }

    if (!newApiKey.trim()) {
      setError('API key cannot be empty')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/settings/fashn-api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newApiKey }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('FASHN API key updated successfully')
        setApiKey(data)
        setIsEditingApiKey(false)
        setNewApiKey('')
        setConfirmApiKey('')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Failed to update API key')
      }
    } catch (err: any) {
      console.error('Error updating API key:', err)
      setError(err.message || 'Failed to update API key')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingApiKey(false)
    setNewApiKey('')
    setConfirmApiKey('')
    setError(null)
  }

  const isAdmin = profile?.role === 'admin'

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Account</h1>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* FASHN AI Account Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">FASHN AI Account</h2>
        
        <p className="text-gray-600 mb-4">
          Manage your FASHN AI account settings and access the FASHN AI dashboard.
        </p>

        <div className="space-y-3 mb-6">
          <div>
            <a
              href="https://app.fashn.ai/api/requests"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 underline"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Requests
            </a>
            <p className="text-sm text-gray-500 ml-7">View and manage your FASHN AI try-on requests</p>
          </div>

          <div>
            <a
              href="https://app.fashn.ai/api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 underline"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              API Keys
            </a>
            <p className="text-sm text-gray-500 ml-7">Manage your FASHN AI API keys</p>
          </div>

          <div>
            <a
              href="https://app.fashn.ai/api/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 underline"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Billing
            </a>
            <p className="text-sm text-gray-500 ml-7">View billing information and manage your subscription</p>
          </div>
        </div>
      </div>

      {/* API Key Management (Admin Only) */}
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">FASHN API Key</h2>
              <p className="text-sm text-gray-600 mt-1">
                Update the FASHN AI API key if you need to use a different account
              </p>
            </div>
            {!isEditingApiKey && (
              <button
                onClick={() => setIsEditingApiKey(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
              >
                Update API Key
              </button>
            )}
          </div>

          {isEditingApiKey ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="current-key" className="block text-sm font-medium text-gray-700 mb-1">
                  Current API Key
                </label>
                <input
                  id="current-key"
                  type="text"
                  value={apiKey?.apiKey || 'Not set'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed font-mono text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-key" className="block text-sm font-medium text-gray-700 mb-1">
                  New API Key
                </label>
                <input
                  id="new-key"
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Enter new FASHN API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-mono text-sm"
                />
              </div>
              <div>
                <label htmlFor="confirm-key" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New API Key
                </label>
                <input
                  id="confirm-key"
                  type="password"
                  value={confirmApiKey}
                  onChange={(e) => setConfirmApiKey(e.target.value)}
                  placeholder="Confirm new FASHN API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save API Key'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current API Key
              </label>
              <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm">
                {apiKey?.hasKey ? apiKey.apiKey : 'Not configured'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The API key is masked for security. Only the last 4 characters are visible.
              </p>
            </div>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">
            API key management is only available to administrators.
          </p>
        </div>
      )}
    </div>
  )
}
