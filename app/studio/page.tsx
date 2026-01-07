'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TryOnRequest, TryOnResult, Category, Mode, GarmentPhotoType, ModerationLevel, OutputFormat } from '@/lib/fashn/types'

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

interface LookBoard {
  id: string
  title: string
}

interface TryOnSession {
  selectedIndex: number | null
  previewResults: TryOnResult[]
  finalResult: TryOnResult | null
  seeds: number[]
  params: Partial<TryOnRequest>
  timestamps: {
    preview?: string
    finalized?: string
  }
}

// Cache key generator
function getCacheKey(modelImage: string, garmentImage: string, params: Partial<TryOnRequest>): string {
  const keyParts = [
    modelImage.substring(0, 50),
    garmentImage.substring(0, 50),
    params.seed || 'none',
    params.mode || 'balanced',
    params.category || 'auto',
    params.num_samples || 1,
  ]
  return btoa(keyParts.join('|')).substring(0, 64)
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
  
  // Two-phase workflow state
  const [session, setSession] = useState<TryOnSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null) // Status message during async operations
  const [error, setError] = useState<string | null>(null)
  
  // Advanced controls state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedSettings, setAdvancedSettings] = useState<Partial<TryOnRequest>>({
    category: 'auto',
    mode: 'balanced',
    seed: undefined,
    num_samples: 1,
    garment_photo_type: 'auto',
    segmentation_free: true,
    moderation_level: 'permissive',
    output_format: 'png',
    return_base64: false,
  })
  const [lockSeed, setLockSeed] = useState(false)
  
  // UI state
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [boards, setBoards] = useState<LookBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  
  // Result cache
  const [resultCache, setResultCache] = useState<Map<string, TryOnResult[]>>(new Map())
  
  // Polling intervals (for cleanup)
  const pollingIntervalsRef = useRef<NodeJS.Timeout[]>([])

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tryon_advanced_settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setAdvancedSettings(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Error loading saved settings:', e)
      }
    }
  }, [])

  // Save settings to localStorage
  const saveSettings = useCallback((settings: Partial<TryOnRequest>) => {
    localStorage.setItem('tryon_advanced_settings', JSON.stringify(settings))
  }, [])

  useEffect(() => {
    fetchActors()
    fetchGarments()
    fetchBoards()
    
    // Cleanup polling intervals on unmount
    return () => {
      pollingIntervalsRef.current.forEach(id => {
        clearInterval(id)
        clearTimeout(id)
      })
      pollingIntervalsRef.current = []
    }
  }, [])

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

  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/look-boards')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setBoards(data)
      }
    } catch (error) {
      console.error('Error fetching boards:', error)
    }
  }

  const fetchActors = async () => {
    try {
      const response = await fetch('/api/actors')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setActors(data)
      }
    } catch (error) {
      console.error('Error fetching actors:', error)
    }
  }

  const fetchGarments = async () => {
    try {
      const response = await fetch('/api/garments')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setGarments(data)
      }
    } catch (error) {
      console.error('Error fetching garments:', error)
    }
  }

  const fetchActorPhotos = async (actorId: string) => {
    try {
      const response = await fetch(`/api/actors/${actorId}/photos`)
      const data = await response.json()
      setActorPhotos(data)
      
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

  // Check cache before making request
  const getCachedResult = (modelImage: string, garmentImage: string, params: Partial<TryOnRequest>): TryOnResult[] | null => {
    const cacheKey = getCacheKey(modelImage, garmentImage, params)
    return resultCache.get(cacheKey) || null
  }

  // Store result in cache
  const cacheResult = (modelImage: string, garmentImage: string, params: Partial<TryOnRequest>, results: TryOnResult[]) => {
    const cacheKey = getCacheKey(modelImage, garmentImage, params)
    setResultCache(prev => new Map(prev).set(cacheKey, results))
  }

  // Fast Preview: Generate samples with performance mode (uses num_samples from settings)
  const handleFastPreview = async () => {
    if (!selectedActorPhotoId || !selectedGarmentImageId) {
      setError('Please select both an actor photo and a garment image')
      return
    }

    const modelImageUrl = signedUrls[selectedActorPhotoId]
    const garmentImageUrl = signedUrls[selectedGarmentImageId]

    if (!modelImageUrl || !garmentImageUrl) {
      setError('Images not loaded. Please wait a moment and try again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check cache first
      // Use num_samples from advancedSettings, default to 1 if not set
      const numSamples = advancedSettings.num_samples || 1
      const previewParams: Partial<TryOnRequest> = {
        ...advancedSettings,
        mode: 'performance',
        num_samples: numSamples,
      }
      
      const cached = getCachedResult(modelImageUrl, garmentImageUrl, previewParams)
      if (cached) {
        setSession({
          selectedIndex: null,
          previewResults: cached,
          finalResult: null,
          seeds: cached.map(r => r.seed),
          params: previewParams,
          timestamps: { preview: new Date().toISOString() },
        })
        setLoading(false)
        return
      }

      // Generate unique seeds for each sample (if API requires single seed per request)
      // For now, we'll submit one request with num_samples=4
      const response = await fetch('/api/tryon/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_photo_id: selectedActorPhotoId,
          garment_image_id: selectedGarmentImageId,
          ...previewParams,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate preview')
      }

      const data = await response.json()
      
      // Handle async job (202 Accepted)
      if (response.status === 202 && data.jobId && data.isAsync) {
        console.log('[Studio] Async job created, polling for results:', data.jobId)
        setLoadingStatus('Job created, waiting for processing...')
        
        // Poll for results
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/tryon/${data.jobId}`)
            if (statusResponse.ok) {
              const job = await statusResponse.json()
              
              // Update status message based on job status
              if (job.status === 'queued') {
                setLoadingStatus('Job queued, waiting to start...')
              } else if (job.status === 'running') {
                setLoadingStatus('Processing try-on... This may take a moment.')
              } else if (job.status === 'succeeded' && job.result_url) {
                clearInterval(pollInterval)
                pollingIntervalsRef.current = pollingIntervalsRef.current.filter(id => id !== pollInterval)
                setLoadingStatus('Processing complete!')
                
                // Convert job to result format
                const result: TryOnResult = {
                  imageUrl: job.result_url,
                  seed: previewParams.seed || 0,
                  params: previewParams,
                  createdAt: job.created_at,
                  requestId: job.id,
                }
                
                // Cache result
                cacheResult(modelImageUrl, garmentImageUrl, previewParams, [result])
                
                setSession({
                  selectedIndex: null,
                  previewResults: [result],
                  finalResult: null,
                  seeds: [result.seed],
                  params: previewParams,
                  timestamps: { preview: new Date().toISOString() },
                })
                setLoading(false)
                setLoadingStatus(null)
              } else if (job.status === 'failed') {
                clearInterval(pollInterval)
                pollingIntervalsRef.current = pollingIntervalsRef.current.filter(id => id !== pollInterval)
                setError(job.error_message || 'Try-on generation failed')
                setLoading(false)
                setLoadingStatus(null)
              }
            }
          } catch (pollError) {
            console.error('Error polling job status:', pollError)
            setLoadingStatus('Checking status...')
          }
        }, 2000) // Poll every 2 seconds
        
        pollingIntervalsRef.current.push(pollInterval)
        
        // Timeout after 60 seconds
        const timeoutId = setTimeout(() => {
          clearInterval(pollInterval)
          pollingIntervalsRef.current = pollingIntervalsRef.current.filter(id => id !== pollInterval)
          setError('Request timed out. Please try again.')
          setLoading(false)
        }, 60000)
        
        pollingIntervalsRef.current.push(timeoutId as any)
        
        return // Don't process further, polling will update state
      }
      
      // Handle synchronous results
      if (!data.results || data.results.length === 0) {
        throw new Error('No results returned')
      }

      // Cache results
      cacheResult(modelImageUrl, garmentImageUrl, previewParams, data.results)

      setSession({
        selectedIndex: null,
        previewResults: data.results,
        finalResult: null,
        seeds: data.results.map((r: TryOnResult) => r.seed),
        params: previewParams,
        timestamps: { preview: new Date().toISOString() },
      })
    } catch (err: any) {
      console.error('Error generating preview:', err)
      setError(err.message || 'Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  // Finalize: Re-run selected variant with quality mode
  const handleFinalize = async (selectedIndex: number) => {
    if (!session || !session.previewResults[selectedIndex]) {
      setError('No preview result selected')
      return
    }

    const selectedResult = session.previewResults[selectedIndex]
    const modelImageUrl = signedUrls[selectedActorPhotoId]
    const garmentImageUrl = signedUrls[selectedGarmentImageId]

    if (!modelImageUrl || !garmentImageUrl) {
      setError('Images not loaded')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const finalizeParams: Partial<TryOnRequest> = {
        ...session.params,
        mode: 'quality',
        seed: selectedResult.seed, // Use same seed for reproducibility
        num_samples: 1,
      }

      // Check cache
      const cached = getCachedResult(modelImageUrl, garmentImageUrl, finalizeParams)
      if (cached && cached[0]) {
        setSession({
          ...session,
          selectedIndex,
          finalResult: cached[0],
          timestamps: {
            ...session.timestamps,
            finalized: new Date().toISOString(),
          },
        })
        setLoading(false)
        return
      }

      const response = await fetch('/api/tryon/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_photo_id: selectedActorPhotoId,
          garment_image_id: selectedGarmentImageId,
          ...finalizeParams,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to finalize')
      }

      const data = await response.json()
      
      // Handle async job (202 Accepted)
      if (response.status === 202 && data.jobId && data.isAsync) {
        console.log('[Studio] Async job created for finalize, polling for results:', data.jobId)
        setLoadingStatus('Finalizing with high quality...')
        
        // Poll for results
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/tryon/${data.jobId}`)
            if (statusResponse.ok) {
              const job = await statusResponse.json()
              
              // Update status message based on job status
              if (job.status === 'queued') {
                setLoadingStatus('Job queued, waiting to start...')
              } else if (job.status === 'running') {
                setLoadingStatus('Processing final high-quality result...')
              } else if (job.status === 'succeeded' && job.result_url) {
                clearInterval(pollInterval)
                pollingIntervalsRef.current = pollingIntervalsRef.current.filter(id => id !== pollInterval)
                setLoadingStatus('Finalization complete!')
                
                // Convert job to result format
                const finalResult: TryOnResult = {
                  imageUrl: job.result_url,
                  seed: selectedResult.seed,
                  params: finalizeParams,
                  createdAt: job.created_at,
                  requestId: job.id,
                }
                
                // Cache result
                cacheResult(modelImageUrl, garmentImageUrl, finalizeParams, [finalResult])
                
                setSession({
                  ...session,
                  selectedIndex,
                  finalResult,
                  timestamps: {
                    ...session.timestamps,
                    finalized: new Date().toISOString(),
                  },
                })
                setLoading(false)
                setLoadingStatus(null)
              } else if (job.status === 'failed') {
                clearInterval(pollInterval)
                pollingIntervalsRef.current = pollingIntervalsRef.current.filter(id => id !== pollInterval)
                setError(job.error_message || 'Try-on generation failed')
                setLoading(false)
                setLoadingStatus(null)
              }
            }
          } catch (pollError) {
            console.error('Error polling job status:', pollError)
            setLoadingStatus('Checking status...')
          }
        }, 2000) // Poll every 2 seconds
        
        pollingIntervalsRef.current.push(pollInterval)
        
        // Timeout after 60 seconds
        const timeoutId = setTimeout(() => {
          clearInterval(pollInterval)
          pollingIntervalsRef.current = pollingIntervalsRef.current.filter(id => id !== pollInterval)
          setError('Request timed out. Please try again.')
          setLoading(false)
          setLoadingStatus(null)
        }, 60000)
        
        pollingIntervalsRef.current.push(timeoutId as any)
        
        return // Don't process further, polling will update state
      }
      
      // Handle synchronous results
      if (!data.results || data.results.length === 0) {
        throw new Error('No results returned')
      }

      const finalResult = data.results[0]
      
      // Cache result
      cacheResult(modelImageUrl, garmentImageUrl, finalizeParams, [finalResult])

      setSession({
        ...session,
        selectedIndex,
        finalResult,
        timestamps: {
          ...session.timestamps,
          finalized: new Date().toISOString(),
        },
      })
      setLoadingStatus(null)
    } catch (err: any) {
      console.error('Error finalizing:', err)
      setError(err.message || 'Failed to finalize')
      setLoadingStatus(null)
    } finally {
      setLoading(false)
    }
  }

  // Reroll: Generate new preview with new seeds
  const handleReroll = () => {
    setAdvancedSettings(prev => ({ ...prev, seed: undefined }))
    setLockSeed(false)
    handleFastPreview()
  }

  // Recreate: Regenerate with same seed
  const handleRecreate = () => {
    if (!session || session.selectedIndex === null) {
      setError('Please select a preview result first')
      return
    }
    handleFinalize(session.selectedIndex)
  }

  // Legacy generate (backward compatibility)
  const handleGenerate = async () => {
    if (!selectedActorPhotoId || !selectedGarmentImageId) {
      setError('Please select both an actor photo and a garment image')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_photo_id: selectedActorPhotoId,
          garment_image_id: selectedGarmentImageId,
          settings: advancedSettings,
        }),
      })
      
      if (response.ok) {
        const job = await response.json()
        // Convert to new format for display
        if (job.result_url) {
          setSession({
            selectedIndex: 0,
            previewResults: [],
            finalResult: {
              imageUrl: job.result_url,
              seed: advancedSettings.seed || 0,
              params: advancedSettings,
              createdAt: job.created_at,
              requestId: job.id,
            },
            seeds: [advancedSettings.seed || 0],
            params: advancedSettings,
            timestamps: { finalized: job.created_at },
          })
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to generate try-on')
      }
    } catch (err: any) {
      console.error('Error creating try-on job:', err)
      setError(err.message || 'Failed to create try-on job')
    } finally {
      setLoading(false)
    }
  }

  const selectedActorPhotoData = actorPhotos.find(p => p.id === selectedActorPhotoId)
  const selectedGarmentImageData = garmentImages.find(i => i.id === selectedGarmentImageId)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Try-On Studio</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

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

      {/* Advanced Controls (Collapsed by default) */}
      <div className="mb-6 border border-gray-200 rounded-lg">
        <button
          onClick={() => {
            setShowAdvanced(!showAdvanced)
            if (!showAdvanced) {
              saveSettings(advancedSettings)
            }
          }}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <span className="font-medium text-gray-900">Advanced Settings</span>
          <svg
            className={`w-5 h-5 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="p-4 border-t border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={advancedSettings.category || 'auto'}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, category: e.target.value as Category }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="auto">Auto</option>
                  <option value="tops">Tops</option>
                  <option value="bottoms">Bottoms</option>
                  <option value="one-pieces">One-Pieces</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={advancedSettings.mode || 'balanced'}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, mode: e.target.value as Mode }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="performance">Performance</option>
                  <option value="balanced">Balanced</option>
                  <option value="quality">Quality</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Garment Photo Type</label>
                <select
                  value={advancedSettings.garment_photo_type || 'auto'}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, garment_photo_type: e.target.value as GarmentPhotoType }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="auto">Auto</option>
                  <option value="model">Model</option>
                  <option value="flat-lay">Flat-Lay</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moderation Level</label>
                <select
                  value={advancedSettings.moderation_level || 'permissive'}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, moderation_level: e.target.value as ModerationLevel }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="permissive">Permissive</option>
                  <option value="conservative">Conservative</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Output Format</label>
                <select
                  value={advancedSettings.output_format || 'png'}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, output_format: e.target.value as OutputFormat }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Samples</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={advancedSettings.num_samples || 1}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 1
                    const newSettings = { ...advancedSettings, num_samples: Math.max(1, Math.min(4, num)) }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="segmentation-free"
                  checked={advancedSettings.segmentation_free !== false}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, segmentation_free: e.target.checked }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="segmentation-free" className="ml-2 text-sm text-gray-700">
                  Segmentation Free
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lock-seed"
                  checked={lockSeed}
                  onChange={(e) => setLockSeed(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="lock-seed" className="ml-2 text-sm text-gray-700">
                  Lock Seed (for reproducibility)
                </label>
              </div>

              {lockSeed && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seed</label>
                  <input
                    type="number"
                    min={0}
                    max={2147483647}
                    value={advancedSettings.seed || ''}
                    onChange={(e) => {
                      const seed = e.target.value ? parseInt(e.target.value) : undefined
                      const newSettings = { ...advancedSettings, seed }
                      setAdvancedSettings(newSettings)
                      saveSettings(newSettings)
                    }}
                    placeholder="Auto-generate if empty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  />
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="return-base64"
                  checked={advancedSettings.return_base64 || false}
                  onChange={(e) => {
                    const newSettings = { ...advancedSettings, return_base64: e.target.checked }
                    setAdvancedSettings(newSettings)
                    saveSettings(newSettings)
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="return-base64" className="ml-2 text-sm text-gray-700">
                  Privacy Mode (Return Base64 - if supported)
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={handleFastPreview}
          disabled={loading || !selectedActorPhotoId || !selectedGarmentImageId}
          className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading 
            ? (loadingStatus || 'Generating Preview...')
            : `Fast Preview (${advancedSettings.num_samples || 1} ${(advancedSettings.num_samples || 1) === 1 ? 'sample' : 'samples'})`}
        </button>

        <button
          onClick={handleGenerate}
          disabled={loading || !selectedActorPhotoId || !selectedGarmentImageId}
          className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (loadingStatus || 'Generating...') : 'Generate (Legacy)'}
        </button>

        {session && session.previewResults.length > 0 && (
          <>
            <button
              onClick={handleReroll}
              disabled={loading}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              Reroll (New Seed)
            </button>
            {session.selectedIndex !== null && (
              <button
                onClick={handleRecreate}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Recreate (Same Seed)
              </button>
            )}
          </>
        )}
      </div>

      {/* Preview Results Grid */}
      {session && session.previewResults.length > 0 && (
        <div className="mb-6 border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Preview Results - Select Your Favorite</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {session.previewResults.map((result, index) => (
              <div
                key={index}
                onClick={() => {
                  setSession({ ...session, selectedIndex: index })
                  handleFinalize(index)
                }}
                className={`cursor-pointer border-2 rounded-lg overflow-hidden ${
                  session.selectedIndex === index
                    ? 'border-indigo-600 ring-2 ring-indigo-300'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-48 object-contain bg-gray-100"
                  />
                ) : result.base64 ? (
                  <img
                    src={result.base64}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-48 object-contain bg-gray-100"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200" />
                )}
                <div className="p-2 bg-gray-50">
                  <p className="text-xs text-gray-600">Seed: {result.seed}</p>
                  {session.selectedIndex === index && (
                    <p className="text-xs text-indigo-600 font-medium mt-1">Selected</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Result Display */}
      {session && session.finalResult && (
        <div className="mb-6 border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Final Result</h2>
          
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
              {session.finalResult.imageUrl ? (
                <img
                  src={session.finalResult.imageUrl}
                  alt="Try-on result"
                  className="w-full rounded-lg border border-gray-200 object-contain bg-gray-100"
                />
              ) : session.finalResult.base64 ? (
                <img
                  src={session.finalResult.base64}
                  alt="Try-on result"
                  className="w-full rounded-lg border border-gray-200 object-contain bg-gray-100"
                />
              ) : null}
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            <p>Seed: {session.finalResult.seed}</p>
            <p>Mode: {session.finalResult.params.mode || 'balanced'}</p>
            {session.timestamps.finalized && (
              <p>Finalized: {new Date(session.timestamps.finalized).toLocaleString()}</p>
            )}
          </div>

          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Save to Look Board
          </button>
        </div>
      )}

      {/* Save to Board Modal */}
      {showSaveModal && session?.finalResult && (
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
                  if (!selectedBoardId || !session?.finalResult) return
                  setSaving(true)
                  try {
                    // First, we need to create a tryon_job record
                    // For now, we'll save the image URL/base64 to a look board item
                    // In a full implementation, we'd upload the result to storage first
                    const response = await fetch('/api/look-boards', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: `Try-on ${new Date().toLocaleString()}`,
                        description: `Seed: ${session.finalResult.seed}, Mode: ${session.finalResult.params.mode}`,
                      }),
                    })
                    
                    if (response.ok) {
                      const board = await response.json()
                      // Note: In a full implementation, we'd need to create a tryon_job
                      // and then add it to the look board. For now, this is a simplified version.
                      alert('Saved! (Note: Full integration with look boards requires storing the result image first)')
                      setShowSaveModal(false)
                      setSelectedBoardId('')
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
