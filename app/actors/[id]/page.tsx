'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { analyzePhoto } from '@/lib/photoAnalysis/analyze'
import { PhotoChecklist } from '@/components/PhotoChecklist'
import { PhotoQualityBadge } from '@/components/PhotoQualityBadge'
import type { PhotoAnalysisResult } from '@/lib/photoAnalysis/types'

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
    qualityAnalysis?: PhotoAnalysisResult
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
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploadAnalysis, setUploadAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showUploadChecklist, setShowUploadChecklist] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchUserAndProfile()
      fetchActor()
      fetchPhotos()
    }
  }, [params.id])

  // Handle ESC key to close photo viewer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPhotoUrl) {
        setSelectedPhotoUrl(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedPhotoUrl])

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
      
      // Get signed URLs for all photos, filter out orphaned records (files that don't exist)
      const urls: Record<string, string> = {}
      const validPhotos: ActorPhoto[] = []
      
      for (const photo of data) {
        const urlResponse = await fetch(`/api/storage/signed-url?bucket=actors&path=${encodeURIComponent(photo.storage_path)}`)
        if (urlResponse.ok) {
          const { url } = await urlResponse.json()
          urls[photo.id] = url
          validPhotos.push(photo)
        } else if (urlResponse.status === 404) {
          // File doesn't exist - this is an orphaned record
          console.warn('[Actor Photos] Orphaned photo record (file not found):', {
            photoId: photo.id,
            storagePath: photo.storage_path,
            actorId: params.id
          })
          // Don't add to validPhotos - this will hide it from the UI
        } else {
          // Other error - log but still try to show it
          console.error('[Actor Photos] Error fetching signed URL:', {
            photoId: photo.id,
            status: urlResponse.status
          })
        }
      }
      
      // Update photos list to only show valid ones (with existing files)
      setPhotos(validPhotos)
      setSignedUrls(urls)
    } catch (error) {
      console.error('Error fetching photos:', error)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // For now, handle first file only (can extend to multiple later)
    const file = files[0]
    setUploadingFile(file)
    setAnalyzing(true)
    setShowUploadChecklist(true)
    setUploadAnalysis(null)

    try {
      // Run analysis
      const analysis = await analyzePhoto(file, 'actor')
      setUploadAnalysis(analysis)
    } catch (error: any) {
      console.error('Error analyzing photo:', error)
      // Continue with upload even if analysis fails
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFileUpload = async (analysisResult?: PhotoAnalysisResult) => {
    if (!uploadingFile) return

    const isFirstUpload = photos.length === 0

    try {
      const formData = new FormData()
      formData.append('file', uploadingFile)
      formData.append('is_primary', isFirstUpload ? 'true' : 'false')
      
      // Include analysis result in metadata if available
      if (analysisResult) {
        formData.append('analysis', JSON.stringify(analysisResult))
      }

      const response = await fetch(`/api/actors/${params.id}/photos`, {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to upload: ${error.error || 'Unknown error'}`)
      }
      
      // Reset state
      setUploadingFile(null)
      setUploadAnalysis(null)
      setShowUploadChecklist(false)
      fetchPhotos()
    } catch (error: any) {
      console.error('Error uploading photo:', error)
      alert(`Error uploading photo: ${error.message || 'Unknown error'}`)
    }
  }

  const handleRetakePhoto = () => {
    setUploadingFile(null)
    setUploadAnalysis(null)
    setShowUploadChecklist(false)
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) fileInput.value = ''
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
        // Show the detailed message if available (for blocked deletions)
        const message = error.message || error.error || 'Failed to delete photo'
        alert(message)
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
          onChange={handleFileSelect}
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
                className="w-full h-64 object-contain bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedPhotoUrl(signedUrls[photo.id])}
              />
            ) : (
              <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                Loading...
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-2 z-10 flex-wrap">
              {photo.is_primary && (
                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                  Primary
                </span>
              )}
              {photo.metadata?.qualityAnalysis && (
                <PhotoQualityBadge analysis={photo.metadata.qualityAnalysis} size="sm" />
              )}
            </div>
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
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="flex-1 bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                  title="Delete photo"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No photos yet. Upload a photo to get started.
        </div>
      )}

      {/* Upload Checklist Modal */}
      {showUploadChecklist && uploadingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Photo Quality Check</h2>
                <button
                  onClick={handleRetakePhoto}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Preview */}
              <div className="mb-4">
                <img
                  src={URL.createObjectURL(uploadingFile)}
                  alt="Preview"
                  className="max-w-full max-h-64 mx-auto rounded-lg"
                />
              </div>

              {/* Checklist */}
              <PhotoChecklist
                kind="actor"
                analysis={uploadAnalysis}
                isLoading={analyzing}
                onRetake={handleRetakePhoto}
                onSaveAnyway={() => handleFileUpload(uploadAnalysis)}
              />

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleRetakePhoto}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleFileUpload(uploadAnalysis)}
                  className={`flex-1 px-4 py-2 rounded-md text-white ${
                    uploadAnalysis?.status === 'fail'
                      ? 'bg-red-600 hover:bg-red-700'
                      : uploadAnalysis?.status === 'warn'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {uploadAnalysis?.status === 'fail' ? 'Save Anyway' : 'Save Photo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Photo Modal */}
      {selectedPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <button
            onClick={() => setSelectedPhotoUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-4xl font-bold z-10 bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={selectedPhotoUrl}
            alt={`${actor.name} - Full size`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  )
}

