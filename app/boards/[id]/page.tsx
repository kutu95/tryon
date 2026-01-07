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

  useEffect(() => {
    if (params.id) {
      fetchUserAndProfile()
      fetchBoard()
      fetchItems()
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

  const canEdit = board && currentUser && (board.created_by === currentUser.id || profile?.role === 'admin')

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/look-boards/${params.id}/items`)
      const data = await response.json()
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
            <button
              onClick={handleEdit}
              className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden relative group">
            {canEdit && (
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
                title="Delete item"
              >
                Delete
              </button>
            )}
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
    </div>
  )
}

