'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Actor {
  id: string
  name: string
  notes?: string
  created_by?: string
}

interface Profile {
  id: string
  role: 'admin' | 'stylist' | 'viewer'
}

interface ActorPhoto {
  id: string
  storage_path: string
  is_primary: boolean
  tags: string[]
}

export default function ActorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [actor, setActor] = useState<Actor | null>(null)
  const [photos, setPhotos] = useState<ActorPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    if (params.id) {
      fetchUserAndProfile()
      fetchActor()
      fetchPhotos()
    }
  }, [params.id])

  const fetchUserAndProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
      }
    } catch (error) {
      console.error('Error fetching user/profile:', error)
    }
  }

  const fetchActor = async () => {
    try {
      const response = await fetch(`/api/actors/${params.id}`)
      const data = await response.json()
      setActor(data)
      setEditName(data.name || '')
      setEditNotes(data.notes || '')
    } catch (error) {
      console.error('Error fetching actor:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (actor) {
      setEditName(actor.name)
      setEditNotes(actor.notes || '')
    }
  }

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/actors/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          notes: editNotes,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setActor(data)
        setIsEditing(false)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating actor:', error)
      alert('Failed to update actor')
    }
  }

  const canEdit = actor && currentUser && (actor.created_by === currentUser.id || profile?.role === 'admin')

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`/api/actors/${params.id}/photos`)
      const data = await response.json()
      setPhotos(data)
      
      // Get signed URLs for all photos
      const urls: Record<string, string> = {}
      for (const photo of data) {
        const urlResponse = await fetch(`/api/storage/signed-url?bucket=actors&path=${encodeURIComponent(photo.storage_path)}`)
        if (urlResponse.ok) {
          const { url } = await urlResponse.json()
          urls[photo.id] = url
        }
      }
      setSignedUrls(urls)
    } catch (error) {
      console.error('Error fetching photos:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const isFirstUpload = photos.length === 0

    try {
      // Upload all files
      const uploadPromises = fileArray.map(async (file, index) => {
        const formData = new FormData()
        formData.append('file', file)
        // Set first file as primary if this is the first upload, otherwise false
        formData.append('is_primary', isFirstUpload && index === 0 ? 'true' : 'false')

        const response = await fetch(`/api/actors/${params.id}/photos`, {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(`Failed to upload ${file.name}: ${error.error || 'Unknown error'}`)
        }
        
        return response.json()
      })

      await Promise.all(uploadPromises)
      fetchPhotos()
      
      // Reset the file input
      e.target.value = ''
    } catch (error: any) {
      console.error('Error uploading photos:', error)
      alert(`Error uploading photos: ${error.message || 'Unknown error'}`)
    }
  }

  const handleSetPrimary = async (photoId: string) => {
    try {
      const response = await fetch(`/api/actors/${params.id}/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: true }),
      })
      if (response.ok) {
        fetchPhotos()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to set primary photo'}`)
      }
    } catch (error) {
      console.error('Error setting primary photo:', error)
      alert('Failed to set primary photo')
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return
    }

    try {
      const response = await fetch(`/api/actors/${params.id}/photos/${photoId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchPhotos()
        // Remove from signedUrls
        setSignedUrls(prev => {
          const newUrls = { ...prev }
          delete newUrls[photoId]
          return newUrls
        })
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete photo'}`)
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
      alert('Failed to delete photo')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!actor) {
    return <div className="text-center py-8">Actor not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-800 mb-4"
        >
          ← Back to Actors
        </button>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-3xl font-bold w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="Actor name"
                />
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  rows={3}
                  placeholder="Notes"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{actor.name}</h1>
                {actor.notes && (
                  <p className="text-gray-600 mt-2">{actor.notes}</p>
                )}
              </>
            )}
          </div>
          {canEdit && !isEditing && (
            <button
              onClick={handleEdit}
              className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Photo
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="relative border border-gray-200 rounded-lg overflow-hidden group">
            {signedUrls[photo.id] ? (
              <img
                src={signedUrls[photo.id]}
                alt={`${actor.name} photo`}
                className="w-full h-64 object-contain bg-gray-100"
              />
            ) : (
              <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                Loading...
              </div>
            )}
            {photo.is_primary && (
              <span className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded z-10">
                Primary
              </span>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {!photo.is_primary && (
                <button
                  onClick={() => handleSetPrimary(photo.id)}
                  className="flex-1 bg-indigo-600 text-white text-xs px-2 py-1 rounded hover:bg-indigo-700"
                  title="Set as primary"
                >
                  Set Primary
                </button>
              )}
              <button
                onClick={() => handleDeletePhoto(photo.id)}
                className="flex-1 bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                title="Delete photo"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No photos yet. Upload a photo to get started.
        </div>
      )}
    </div>
  )
}

