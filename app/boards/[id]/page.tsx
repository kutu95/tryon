'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface LookBoard {
  id: string
  title: string
  description?: string
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
  const [board, setBoard] = useState<LookBoard | null>(null)
  const [items, setItems] = useState<LookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (params.id) {
      fetchBoard()
      fetchItems()
    }
  }, [params.id])

  const fetchBoard = async () => {
    try {
      const response = await fetch(`/api/look-boards/${params.id}`)
      const data = await response.json()
      setBoard(data)
    } catch (error) {
      console.error('Error fetching board:', error)
    } finally {
      setLoading(false)
    }
  }

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
        <h1 className="text-3xl font-bold">{board.title}</h1>
        {board.description && (
          <p className="text-gray-600 mt-2">{board.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {signedUrls[item.id] ? (
              <img
                src={signedUrls[item.id]}
                alt={item.label || 'Try-on result'}
                className="w-full h-64 object-cover"
              />
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

      {items.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No items in this board yet. Add try-on results from the Studio.
        </div>
      )}
    </div>
  )
}

