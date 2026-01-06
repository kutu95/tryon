'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Actor {
  id: string
  name: string
  notes?: string
  created_at: string
  primary_photo?: {
    id: string
    storage_path: string
  } | null
}

export default function ActorsPage() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [primaryPhotoUrls, setPrimaryPhotoUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchActors()
  }, [])

  const fetchActors = async () => {
    try {
      const response = await fetch('/api/actors')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setActors(data)
        
        // Fetch signed URLs for primary photos
        const urls: Record<string, string> = {}
        for (const actor of data) {
          if (actor.primary_photo?.storage_path) {
            try {
              const urlResponse = await fetch(
                `/api/storage/signed-url?bucket=actors&path=${encodeURIComponent(actor.primary_photo.storage_path)}`
              )
              if (urlResponse.ok) {
                const { url } = await urlResponse.json()
                urls[actor.id] = url
              }
            } catch (error) {
              console.error(`Error fetching signed URL for actor ${actor.id}:`, error)
            }
          }
        }
        setPrimaryPhotoUrls(urls)
      } else {
        console.error('Error fetching actors:', data.error || data)
        setActors([])
      }
    } catch (error) {
      console.error('Error fetching actors:', error)
      setActors([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/actors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, notes }),
      })
      if (response.ok) {
        setName('')
        setNotes('')
        setShowForm(false)
        fetchActors()
      } else {
        const errorData = await response.json()
        console.error('Error creating actor:', errorData)
        alert(`Error: ${errorData.error}${errorData.details ? `\nDetails: ${errorData.details}` : ''}`)
      }
    } catch (error) {
      console.error('Error creating actor:', error)
      alert('Failed to create actor. Check console for details.')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Actors</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Actor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Actor
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actors.map((actor) => (
          <Link
            key={actor.id}
            href={`/actors/${actor.id}`}
            className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              {primaryPhotoUrls[actor.id] ? (
                <img
                  src={primaryPhotoUrls[actor.id]}
                  alt={actor.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                  <span className="text-gray-400 text-xs">No photo</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold mb-1">{actor.name}</h2>
                {actor.notes && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{actor.notes}</p>
                )}
                <p className="text-xs text-gray-400">
                  Created {new Date(actor.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {actors.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No actors yet. Create your first actor to get started.
        </div>
      )}
    </div>
  )
}

