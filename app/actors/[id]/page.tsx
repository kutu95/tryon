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
  metadata?: {
    source?: string
    model?: string
    quality?: string
    size?: string
    parentPhotoId?: string
  }
  parent_photo_id?: string
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
  const [tuningPhotoId, setTuningPhotoId] = useState<string | null>(null)
  const [tuningOptions, setTuningOptions] = useState({
    model: 'gpt-image-1-mini' as 'gpt-image-1-mini' | 'gpt-image-1',
    quality: 'medium' as 'low' | 'medium' | 'high',
    size: '1024x1024' as '1024x1024' | '1024x1536' | '1536x1024',
    neutralBackground: true,
    lightTouch: true,
  })
  const [tuning, setTuning] = useState(false)

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

  const handleTunePhoto = async () => {
    if (!tuningPhotoId) return

    setTuning(true)
    try {
      const response = await fetch(`/api/actors/${params.id}/photos/${tuningPhotoId}/tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: tuningOptions.model,
          quality: tuningOptions.quality,
          size: tuningOptions.size,
        }),
      })

      if (response.ok) {
        const newPhoto = await response.json()
        setTuningPhotoId(null)
        fetchPhotos()
        // Fetch signed URL for new photo
        const urlResponse = await fetch(`/api/storage/signed-url?bucket=actors&path=${encodeURIComponent(newPhoto.storage_path)}`)
        if (urlResponse.ok) {
          const { url } = await urlResponse.json()
          setSignedUrls(prev => ({ ...prev, [newPhoto.id]: url }))
        }
        alert('Photo tuned successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to tune photo'}`)
      }
    } catch (error: any) {
      console.error('Error tuning photo:', error)
      alert(`Failed to tune photo: ${error.message || 'Unknown error'}`)
    } finally {
      setTuning(false)
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
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              {photo.is_primary && (
                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                  Primary
                </span>
              )}
              {photo.metadata?.source === 'openai' && (
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                  Tuned
                </span>
              )}
            </div>
            {/* Always-visible Tune button */}
            <button
              onClick={() => setTuningPhotoId(photo.id)}
              className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded hover:bg-purple-700 z-10 shadow-lg"
              title="Tune with OpenAI"
            >
              Tune
            </button>
            <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-2">
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
                  onClick={() => setTuningPhotoId(photo.id)}
                  className="flex-1 bg-purple-600 text-white text-xs px-2 py-1 rounded hover:bg-purple-700"
                  title="Tune with OpenAI"
                >
                  Tune
                </button>
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="flex-1 bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                  title="Delete photo"
                >
                  Delete
                </button>
              </div>
            </div>
            {/* Always-visible Tune button for better UX */}
            <button
              onClick={() => setTuningPhotoId(photo.id)}
              className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded hover:bg-purple-700 z-10"
              title="Tune with OpenAI"
            >
              Tune
            </button>
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No photos yet. Upload a photo to get started.
        </div>
      )}

      {/* Tune Photo Modal */}
      {tuningPhotoId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Tune Photo with OpenAI</h2>
            
            {tuning ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                    <p className="text-gray-700 font-medium">Processing image with OpenAI...</p>
                    <p className="text-sm text-gray-500 mt-2">This may take 30-60 seconds</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OpenAI Image Model
                  </label>
                  <select
                    value={tuningOptions.model}
                    onChange={(e) => setTuningOptions(prev => ({ ...prev, model: e.target.value as 'gpt-image-1-mini' | 'gpt-image-1' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    disabled={tuning}
                  >
                    <option value="gpt-image-1-mini">gpt-image-1-mini (default)</option>
                    <option value="gpt-image-1">gpt-image-1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quality
                  </label>
                  <select
                    value={tuningOptions.quality}
                    onChange={(e) => setTuningOptions(prev => ({ ...prev, quality: e.target.value as 'low' | 'medium' | 'high' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    disabled={tuning}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium (default)</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Output Size
                  </label>
                  <select
                    value={tuningOptions.size}
                    onChange={(e) => setTuningOptions(prev => ({ ...prev, size: e.target.value as '1024x1024' | '1024x1536' | '1536x1024' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    disabled={tuning}
                  >
                    <option value="1024x1024">1024x1024 (default)</option>
                    <option value="1024x1536">1024x1536</option>
                    <option value="1536x1024">1536x1024</option>
                  </select>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  if (!tuning) {
                    setTuningPhotoId(null)
                  }
                }}
                disabled={tuning}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tuning ? 'Processing...' : 'Cancel'}
              </button>
              {!tuning && (
                <button
                  onClick={handleTunePhoto}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Tune Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

