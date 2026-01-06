'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Garment {
  id: string
  name: string
  category?: string
  notes?: string
  created_at: string
}

export default function GarmentsPage() {
  const [garments, setGarments] = useState<Garment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchGarments()
  }, [])

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
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/garments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, notes }),
      })
      if (response.ok) {
        setName('')
        setCategory('')
        setNotes('')
        setShowForm(false)
        fetchGarments()
      }
    } catch (error) {
      console.error('Error creating garment:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Garments</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Garment'}
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
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select category</option>
              <option value="top">Top</option>
              <option value="jacket">Jacket</option>
              <option value="dress">Dress</option>
              <option value="pants">Pants</option>
              <option value="accessory">Accessory</option>
            </select>
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
            Create Garment
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {garments.map((garment) => (
          <Link
            key={garment.id}
            href={`/garments/${garment.id}`}
            className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{garment.name}</h2>
            {garment.category && (
              <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded mb-2">
                {garment.category}
              </span>
            )}
            {garment.notes && (
              <p className="text-sm text-gray-600 mb-2">{garment.notes}</p>
            )}
            <p className="text-xs text-gray-400">
              Created {new Date(garment.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>

      {garments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No garments yet. Create your first garment to get started.
        </div>
      )}
    </div>
  )
}

