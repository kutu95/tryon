'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LookBoard {
  id: string
  title: string
  description?: string
  created_at: string
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<LookBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
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
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/look-boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      if (response.ok) {
        setTitle('')
        setDescription('')
        setShowForm(false)
        fetchBoards()
      }
    } catch (error) {
      console.error('Error creating board:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Look Boards</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Create Board'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Board
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/boards/${board.id}`}
            className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{board.title}</h2>
            {board.description && (
              <p className="text-sm text-gray-600 mb-2">{board.description}</p>
            )}
            <p className="text-xs text-gray-400">
              Created {new Date(board.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>

      {boards.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No look boards yet. Create your first board to get started.
        </div>
      )}
    </div>
  )
}

