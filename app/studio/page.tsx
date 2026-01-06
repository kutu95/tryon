'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Actor {
  id: string
  name: string
}

interface ActorPhoto {
  id: string
  actor_id: string
  storage_path: string
  actor?: Actor
}

interface Garment {
  id: string
  name: string
}

interface GarmentImage {
  id: string
  garment_id: string
  storage_path: string
  garment?: Garment
}

interface TryOnJob {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  result_url?: string
  error_message?: string
}

interface LookBoard {
  id: string
  title: string
}

export default function StudioPage() {
  const router = useRouter()
  const [actors, setActors] = useState<Actor[]>([])
  const [garments, setGarments] = useState<Garment[]>([])
  const [actorPhotos, setActorPhotos] = useState<ActorPhoto[]>([])
  const [garmentImages, setGarmentImages] = useState<GarmentImage[]>([])
  const [selectedActorId, setSelectedActorId] = useState<string>('')
  const [selectedActorPhotoId, setSelectedActorPhotoId] = useState<string>('')
  const [selectedGarmentId, setSelectedGarmentId] = useState<string>('')
  const [selectedGarmentImageId, setSelectedGarmentImageId] = useState<string>('')
  const [currentJob, setCurrentJob] = useState<TryOnJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [boards, setBoards] = useState<LookBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchActors()
    fetchGarments()
    fetchBoards()
  }, [])

  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/look-boards')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setBoards(data)
      } else {
        console.error('Error fetching boards:', data.error || data)
        setBoards([])
      }
    } catch (error) {
      console.error('Error fetching boards:', error)
      setBoards([])
    }
  }

  useEffect(() => {
    if (selectedActorId) {
      fetchActorPhotos(selectedActorId)
      setSelectedActorPhotoId('')
    }
  }, [selectedActorId])

  useEffect(() => {
    if (selectedGarmentId) {
      fetchGarmentImages(selectedGarmentId)
      setSelectedGarmentImageId('')
    }
  }, [selectedGarmentId])

  useEffect(() => {
    if (currentJob && (currentJob.status === 'queued' || currentJob.status === 'running')) {
      const interval = setInterval(() => {
        pollJobStatus(currentJob.id)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [currentJob])

  const fetchActors = async () => {
    try {
      const response = await fetch('/api/actors')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setActors(data)
      } else {
        console.error('Error fetching actors:', data.error || data)
        setActors([])
      }
    } catch (error) {
      console.error('Error fetching actors:', error)
      setActors([])
    }
  }

  const fetchGarments = async () => {
    try {
      const response = await fetch('/api/garments')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setGarments(data)
      } else {
        console.error('Error fetching garments:', data.error || data)
        setGarments([])
      }
    } catch (error) {
      console.error('Error fetching garments:', error)
      setGarments([])
    }
  }

  const fetchActorPhotos = async (actorId: string) => {
    try {
      const response = await fetch(`/api/actors/${actorId}/photos`)
      const data = await response.json()
      setActorPhotos(data)
      
      // Get signed URLs
      const urls: Record<string, string> = {}
      for (const photo of data) {
        const urlResponse = await fetch(`/api/storage/signed-url?bucket=actors&path=${encodeURIComponent(photo.storage_path)}`)
        if (urlResponse.ok) {
          const { url } = await urlResponse.json()
          urls[photo.id] = url
        }
      }
      setSignedUrls(prev => ({ ...prev, ...urls }))
    } catch (error) {
      console.error('Error fetching actor photos:', error)
    }
  }

  const fetchGarmentImages = async (garmentId: string) => {
    try {
      const response = await fetch(`/api/garments/${garmentId}/images`)
      const data = await response.json()
      setGarmentImages(data)
      
      // Get signed URLs
      const urls: Record<string, string> = {}
      for (const image of data) {
        const urlResponse = await fetch(`/api/storage/signed-url?bucket=garments&path=${encodeURIComponent(image.storage_path)}`)
        if (urlResponse.ok) {
          const { url } = await urlResponse.json()
          urls[image.id] = url
        }
      }
      setSignedUrls(prev => ({ ...prev, ...urls }))
    } catch (error) {
      console.error('Error fetching garment images:', error)
    }
  }

  const handleGenerate = async () => {
    if (!selectedActorPhotoId || !selectedGarmentImageId) {
      alert('Please select both an actor photo and a garment image')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_photo_id: selectedActorPhotoId,
          garment_image_id: selectedGarmentImageId,
        }),
      })
      
      if (response.ok) {
        const job = await response.json()
        setCurrentJob({ ...job, status: job.status })
        pollJobStatus(job.id)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating try-on job:', error)
      alert('Failed to create try-on job')
    } finally {
      setLoading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/tryon/${jobId}`)
      if (response.ok) {
        const job = await response.json()
        setCurrentJob(job)
      }
    } catch (error) {
      console.error('Error polling job status:', error)
    }
  }

  const selectedActorPhotoData = actorPhotos.find(p => p.id === selectedActorPhotoId)
  const selectedGarmentImageData = garmentImages.find(i => i.id === selectedGarmentImageId)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Try-On Studio</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Actor Selection */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Select Actor Photo</h2>
          <select
            value={selectedActorId}
            onChange={(e) => setSelectedActorId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 text-gray-900"
          >
            <option value="">Select an actor...</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>

          {selectedActorId && (
            <div className="grid grid-cols-2 gap-2">
              {actorPhotos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedActorPhotoId(photo.id)}
                  className={`cursor-pointer border-2 rounded-lg overflow-hidden ${
                    selectedActorPhotoId === photo.id
                      ? 'border-indigo-600'
                      : 'border-gray-200'
                  }`}
                >
                  {signedUrls[photo.id] ? (
                    <img
                      src={signedUrls[photo.id]}
                      alt="Actor photo"
                      className="w-full h-48 object-contain bg-gray-100"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Garment Selection */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Select Garment Image</h2>
          <select
            value={selectedGarmentId}
            onChange={(e) => setSelectedGarmentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 text-gray-900"
          >
            <option value="">Select a garment...</option>
            {garments.map((garment) => (
              <option key={garment.id} value={garment.id}>
                {garment.name}
              </option>
            ))}
          </select>

          {selectedGarmentId && (
            <div className="grid grid-cols-2 gap-2">
              {garmentImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => setSelectedGarmentImageId(image.id)}
                  className={`cursor-pointer border-2 rounded-lg overflow-hidden ${
                    selectedGarmentImageId === image.id
                      ? 'border-indigo-600'
                      : 'border-gray-200'
                  }`}
                >
                  {signedUrls[image.id] ? (
                    <img
                      src={signedUrls[image.id]}
                      alt="Garment image"
                      className="w-full h-48 object-contain bg-gray-100"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="mb-6">
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedActorPhotoId || !selectedGarmentImageId}
          className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Try-On'}
        </button>
      </div>

      {/* Result Display */}
      {currentJob && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Try-On Result</h2>
          
          <div className="mb-4">
            <span className={`inline-block px-3 py-1 rounded text-sm ${
              currentJob.status === 'succeeded' ? 'bg-green-100 text-green-800' :
              currentJob.status === 'failed' ? 'bg-red-100 text-red-800' :
              currentJob.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {currentJob.status.charAt(0).toUpperCase() + currentJob.status.slice(1)}
            </span>
          </div>

          {currentJob.status === 'succeeded' && currentJob.result_url && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Before</h3>
                {selectedActorPhotoData && signedUrls[selectedActorPhotoId] && (
                  <img
                    src={signedUrls[selectedActorPhotoId]}
                    alt="Before"
                    className="w-full rounded-lg border border-gray-200 object-contain bg-gray-100"
                  />
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">After</h3>
                <img
                  src={currentJob.result_url}
                  alt="Try-on result"
                  className="w-full rounded-lg border border-gray-200 object-contain bg-gray-100"
                />
              </div>
            </div>
          )}

          {currentJob.status === 'failed' && currentJob.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{currentJob.error_message}</p>
            </div>
          )}

          {currentJob.status === 'running' && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">Processing try-on...</p>
            </div>
          )}

          {currentJob.status === 'succeeded' && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save to Look Board
            </button>
          )}
        </div>
      )}

      {/* Save to Board Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Save to Look Board</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Board
              </label>
              <select
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              >
                <option value="">Select a board...</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setSelectedBoardId('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedBoardId || !currentJob) return
                  setSaving(true)
                  try {
                    const response = await fetch(`/api/look-boards/${selectedBoardId}/items`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        tryon_job_id: currentJob.id,
                      }),
                    })
                    if (response.ok) {
                      setShowSaveModal(false)
                      setSelectedBoardId('')
                      alert('Saved to look board!')
                    } else {
                      alert('Failed to save to board')
                    }
                  } catch (error) {
                    console.error('Error saving to board:', error)
                    alert('Failed to save to board')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={!selectedBoardId || saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

