'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface LookBoard {
  id: string
  title: string
  description?: string
  created_by?: string
}

interface Profile {
  id: string
  role: 'admin' | 'stylist' | 'viewer'
}

interface LookItem {
  id: string
  label?: string
  notes?: string
  tryon_jobs?: {
    id: string
    result_storage_path?: string
    actor_photos?: {
      storage_path: string
    }
    garment_images?: {
      storage_path: string
    }
  }
}

export default function BoardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [board, setBoard] = useState<LookBoard | null>(null)
  const [items, setItems] = useState<LookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [movingItemId, setMovingItemId] = useState<string | null>(null)
  const [allBoards, setAllBoards] = useState<LookBoard[]>([])
  const [viewingSourcesItemId, setViewingSourcesItemId] = useState<string | null>(null)
  const [sourceImageUrls, setSourceImageUrls] = useState<{
    result?: string
    actor?: string
    garment?: string
  }>({})
  const [loadingSources, setLoadingSources] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchUserAndProfile()
      fetchBoard()
      fetchItems()
      fetchAllBoards()
    }
  }, [params.id])

  const fetchAllBoards = async () => {
    try {
      const response = await fetch('/api/look-boards')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setAllBoards(data.filter((b: LookBoard) => b.id !== params.id)) // Exclude current board
      }
    } catch (error) {
      console.error('Error fetching boards:', error)
    }
  }

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

  const fetchBoard = async () => {
    try {
      const response = await fetch(`/api/look-boards/${params.id}`)
      const data = await response.json()
      setBoard(data)
      setEditTitle(data.title || '')
      setEditDescription(data.description || '')
    } catch (error) {
      console.error('Error fetching board:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (board) {
      setEditTitle(board.title)
      setEditDescription(board.description || '')
    }
  }

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/look-boards/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setBoard(data)
        setIsEditing(false)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating board:', error)
      alert('Failed to update board')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/look-boards/${params.id}/items/${itemId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        fetchItems() // Refresh items
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    }
  }

  const handleDeleteBoard = async () => {
    const itemCount = items.length
    const warningMessage = itemCount > 0
      ? `Are you sure you want to delete this look board? This will permanently delete the board and all ${itemCount} image${itemCount === 1 ? '' : 's'} in it. This action cannot be undone.`
      : 'Are you sure you want to delete this look board? This action cannot be undone.'
    
    if (!confirm(warningMessage)) {
      return
    }
    
    try {
      const response = await fetch(`/api/look-boards/${params.id}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        router.push('/boards')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting board:', error)
      alert('Failed to delete board')
    }
  }

  const handleMoveItem = async (targetBoardId: string) => {
    if (!movingItemId) return

    try {
      const response = await fetch(`/api/look-boards/${params.id}/items/${movingItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_board_id: targetBoardId }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to move item')
      }
      
      setMovingItemId(null)
      fetchItems() // Refresh items (moved item will be gone)
      alert('Item moved successfully!')
    } catch (error: any) {
      console.error('Error moving item:', error)
      alert(`Error moving item: ${error.message || 'Unknown error'}`)
    }
  }

  const handleViewSources = async (item: LookItem) => {
    if (!item.tryon_jobs) {
      alert('Source images are not available for this item')
      return
    }

    setViewingSourcesItemId(item.id)
    setLoadingSources(true)
    setSourceImageUrls({})

    const urls: { result?: string; actor?: string; garment?: string } = {}

    try {
      // Get result image URL (already have it in signedUrls)
      if (signedUrls[item.id]) {
        urls.result = signedUrls[item.id]
      }

      // Get actor photo URL
      if (item.tryon_jobs.actor_photos?.storage_path) {
        const actorResponse = await fetch(
          `/api/storage/signed-url?bucket=actors&path=${encodeURIComponent(item.tryon_jobs.actor_photos.storage_path)}`
        )
        if (actorResponse.ok) {
          const { url } = await actorResponse.json()
          urls.actor = url
        }
      }

      // Get garment image URL
      if (item.tryon_jobs.garment_images?.storage_path) {
        const garmentResponse = await fetch(
          `/api/storage/signed-url?bucket=garments&path=${encodeURIComponent(item.tryon_jobs.garment_images.storage_path)}`
        )
        if (garmentResponse.ok) {
          const { url } = await garmentResponse.json()
          urls.garment = url
        }
      }

      setSourceImageUrls(urls)
    } catch (error) {
      console.error('Error loading source images:', error)
      alert('Failed to load source images')
    } finally {
      setLoadingSources(false)
    }
  }

  const canEdit = board && currentUser && (board.created_by === currentUser.id || profile?.role === 'admin')

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/look-boards/${params.id}/items`)
      const data = await response.json()
      
      if (!response.ok) {
        console.error('Error fetching items:', data.error || 'Unknown error')
        setItems([])
        return
      }
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Error fetching items: Expected array, got:', typeof data)
        setItems([])
        return
      }
      
      setItems(data)
      
      // Get signed URLs for all try-on results
      const urls: Record<string, string> = {}
      for (const item of data) {
        if (item.tryon_jobs?.result_storage_path) {
          const urlResponse = await fetch(`/api/storage/signed-url?bucket=tryons&path=${encodeURIComponent(item.tryon_jobs.result_storage_path)}`)
          if (urlResponse.ok) {
            const { url } = await urlResponse.json()
            urls[item.id] = url
          }
        }
      }
      setSignedUrls(urls)
    } catch (error) {
      console.error('Error fetching items:', error)
      setItems([])
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!board) {
    return <div className="text-center py-8">Board not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-800 mb-4"
        >
          ← Back to Look Boards
        </button>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-3xl font-bold w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  rows={3}
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
                <h1 className="text-3xl font-bold">{board.title}</h1>
                {board.description && (
                  <p className="text-gray-600 mt-2">{board.description}</p>
                )}
              </>
            )}
          </div>
          {canEdit && !isEditing && (
            <div className="ml-4 flex gap-2">
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Edit
              </button>
              <button
                onClick={handleDeleteBoard}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Board
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden relative group">
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {item.tryon_jobs && (
                <button
                  onClick={() => handleViewSources(item)}
                  className="bg-indigo-600 text-white text-xs px-2 py-1 rounded hover:bg-indigo-700"
                  title="View source images"
                >
                  Sources
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    onClick={() => setMovingItemId(item.id)}
                    className="bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700"
                    title="Move to another board"
                  >
                    Move
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                    title="Delete item"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
            {signedUrls[item.id] ? (
              <div
                className="w-full h-64 bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImageUrl(signedUrls[item.id])}
              >
                <img
                  src={signedUrls[item.id]}
                  alt={item.label || 'Try-on result'}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                No image
              </div>
            )}
            <div className="p-4">
              {item.label && (
                <h3 className="font-semibold mb-1">{item.label}</h3>
              )}
              {item.notes && (
                <p className="text-sm text-gray-600">{item.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Full-size image modal */}
      {selectedImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setSelectedImageUrl(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedImageUrl(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={selectedImageUrl}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No items in this board yet. Add try-on results from the Studio.
        </div>
      )}

      {/* View Sources Modal */}
      {viewingSourcesItemId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => {
            setViewingSourcesItemId(null)
            setSourceImageUrls({})
          }}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Source Images</h2>
              <button
                onClick={() => {
                  setViewingSourcesItemId(null)
                  setSourceImageUrls({})
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingSources ? (
                <div className="text-center py-8">Loading source images...</div>
              ) : (
                <>
                  {/* Final Result */}
                  {sourceImageUrls.result && (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-900">Final Try-On Result</h3>
                      <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                        <img
                          src={sourceImageUrls.result}
                          alt="Final try-on result"
                          className="max-w-full max-h-[600px] object-contain"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Actor Photo */}
                  {sourceImageUrls.actor ? (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-900">Actor Photo</h3>
                      <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                        <img
                          src={sourceImageUrls.actor}
                          alt="Actor photo"
                          className="max-w-full max-h-[600px] object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    sourceImageUrls.result && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900">Actor Photo</h3>
                        <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[300px] text-gray-500">
                          Actor photo not available
                        </div>
                      </div>
                    )
                  )}
                  
                  {/* Garment Image */}
                  {sourceImageUrls.garment ? (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-900">Garment Image</h3>
                      <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                        <img
                          src={sourceImageUrls.garment}
                          alt="Garment image"
                          className="max-w-full max-h-[600px] object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    sourceImageUrls.result && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900">Garment Image</h3>
                        <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[300px] text-gray-500">
                          Garment image not available
                        </div>
                      </div>
                    )
                  )}
                  
                  {!sourceImageUrls.result && !sourceImageUrls.actor && !sourceImageUrls.garment && (
                    <div className="text-center py-8 text-gray-500">
                      No source images available for this item
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Move Item Modal */}
      {movingItemId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Move Item to Another Look Board</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Target Look Board
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleMoveItem(e.target.value)
                    }
                  }}
                >
                  <option value="">Choose a look board...</option>
                  {allBoards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setMovingItemId(null)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

