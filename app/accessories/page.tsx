'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Accessory {
  id: string
  name: string
  type?: string
  notes?: string
  created_at: string
}

export default function AccessoriesPage() {
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchAccessories()
  }, [])

  const fetchAccessories = async () => {
    try {
      const response = await fetch('/api/accessories')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setAccessories(data)
      } else {
        console.error('Error fetching accessories:', data.error || data)
        setAccessories([])
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
      setAccessories([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/accessories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, notes }),
      })
      if (response.ok) {
        setName('')
        setType('')
        setNotes('')
        setShowForm(false)
        fetchAccessories()
      } else {
        const errorData = await response.json()
        console.error('Error creating accessory:', errorData)
        alert(`Error: ${errorData.error || 'Failed to create accessory'}`)
      }
    } catch (error) {
      console.error('Error creating accessory:', error)
      alert('Failed to create accessory. Check console for details.')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Accessories</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Accessory'}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">Select type</option>
              <option value="shoes">Shoes</option>
              <option value="glasses">Glasses</option>
              <option value="jewellery">Jewellery</option>
              <option value="hats">Hats</option>
              <option value="gloves">Gloves</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Accessory
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accessories.map((accessory) => (
          <Link
            key={accessory.id}
            href={`/accessories/${accessory.id}`}
            className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{accessory.name}</h2>
            {accessory.type && (
              <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded mb-2">
                {accessory.type}
              </span>
            )}
            {accessory.notes && (
              <p className="text-sm text-gray-600 mb-2">{accessory.notes}</p>
            )}
            <p className="text-xs text-gray-400">
              Created {new Date(accessory.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>

      {accessories.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No accessories yet. Create your first accessory to get started.
        </div>
      )}
    </div>
  )
}

