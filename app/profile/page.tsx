'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  display_name?: string
  role: 'admin' | 'stylist' | 'viewer'
  email?: string
}

export default function ProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Profile editing
  const [displayName, setDisplayName] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/profile')
      const data = await response.json()
      
      if (response.ok) {
        setProfile(data)
        setDisplayName(data.display_name || '')
      } else {
        setError(data.error || 'Failed to fetch profile')
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setError(err.message || 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setProfile(data)
        setIsEditingProfile(false)
        setSuccess('Profile updated successfully')
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Failed to update profile')
      }
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingProfile(false)
    if (profile) {
      setDisplayName(profile.display_name || '')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long')
      return
    }
    
    try {
      setIsChangingPassword(true)
      
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setPasswordSuccess('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        // Clear success message after 3 seconds
        setTimeout(() => setPasswordSuccess(null), 3000)
      } else {
        setPasswordError(data.error || 'Failed to change password')
      }
    } catch (err: any) {
      console.error('Error changing password:', err)
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!profile) {
    return <div className="text-center py-8">Failed to load profile</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Profile</h1>

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

      {/* Profile Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Profile Information</h2>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
            >
              Edit Profile
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                placeholder="Enter your display name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={profile.role}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed capitalize"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
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
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <p className="text-gray-900">{profile.display_name || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="text-gray-900">{profile.email || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="text-gray-900 capitalize">{profile.role}</p>
            </div>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Change Password</h2>
        
        {passwordSuccess && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{passwordSuccess}</p>
          </div>
        )}
        {passwordError && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{passwordError}</p>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={isChangingPassword}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isChangingPassword ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

