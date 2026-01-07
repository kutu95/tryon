'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Garment {
  id: string
  name: string
  category?: string
  notes?: string
  created_by?: string
}

interface Profile {
  id: string
  role: 'admin' | 'stylist' | 'viewer'
}

interface GarmentImage {
  id: string
  storage_path: string
  image_type?: string
  is_primary?: boolean
  tags: string[]
}

export default function GarmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [garment, setGarment] = useState<Garment | null>(null)
  const [images, setImages] = useState<GarmentImage[]>([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [uploadImageType, setUploadImageType] = useState<string>('flat_lay')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    if (params.id) {
      fetchUserAndProfile()
      fetchGarment()
      fetchImages()
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

  const fetchGarment = async () => {
    try {
      const response = await fetch(`/api/garments/${params.id}`)
      const data = await response.json()
      setGarment(data)
      setEditName(data.name || '')
      setEditCategory(data.category || '')
      setEditNotes(data.notes || '')
    } catch (error) {
      console.error('Error fetching garment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (garment) {
      setEditName(garment.name)
      setEditCategory(garment.category || '')
      setEditNotes(garment.notes || '')
    }
  }

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/garments/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          category: editCategory,
          notes: editNotes,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setGarment(data)
        setIsEditing(false)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating garment:', error)
      alert('Failed to update garment')
    }
  }

  const canEdit = garment && currentUser && (garment.created_by === currentUser.id || profile?.role === 'admin')

  const fetchImages = async () => {
    try {
      const response = await fetch(`/api/garments/${params.id}/images`)
      const data = await response.json()
      setImages(data)
      
      // Get signed URLs for all images
      const urls: Record<string, string> = {}
      for (const image of data) {
        const urlResponse = await fetch(`/api/storage/signed-url?bucket=garments&path=${encodeURIComponent(image.storage_path)}`)
        if (urlResponse.ok) {
          const { url } = await urlResponse.json()
          urls[image.id] = url
        }
      }
      setSignedUrls(urls)
    } catch (error) {
      console.error('Error fetching images:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)

    try {
      // Upload all files
      const uploadPromises = fileArray.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('image_type', uploadImageType)

        const response = await fetch(`/api/garments/${params.id}/images`, {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(`Failed to upload ${file.name}: ${error.error || 'Unknown error'}`)
        }
        
        return response.json()
      })

      await Promise.all(uploadPromises)
      fetchImages()
      
      // Reset the file input
      e.target.value = ''
    } catch (error: any) {
      console.error('Error uploading images:', error)
      alert(`Error uploading images: ${error.message || 'Unknown error'}`)
    }
  }

  const handleImageTypeChange = async (imageId: string, newType: string) => {
    try {
      const response = await fetch(`/api/garments/${params.id}/images/${imageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: newType }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update image type')
      }
      
      fetchImages()
    } catch (error: any) {
      console.error('Error updating image type:', error)
      alert(`Error updating image type: ${error.message || 'Unknown error'}`)
    }
  }

  const handleSetPrimary = async (imageId: string) => {
    try {
      const response = await fetch(`/api/garments/${params.id}/images/${imageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: true }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to set primary image')
      }
      
      fetchImages()
    } catch (error: any) {
      console.error('Error setting primary image:', error)
      alert(`Error setting primary image: ${error.message || 'Unknown error'}`)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!garment) {
    return <div className="text-center py-8">Garment not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-800 mb-4"
        >
          ← Back to Garments
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
                  placeholder="Garment name"
                />
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">Select category</option>
                  <option value="top">Top</option>
                  <option value="jacket">Jacket</option>
                  <option value="dress">Dress</option>
                  <option value="pants">Pants</option>
                  <option value="accessory">Accessory</option>
                </select>
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
                <h1 className="text-3xl font-bold">{garment.name}</h1>
                {garment.category && (
                  <span className="inline-block px-3 py-1 text-sm bg-indigo-100 text-indigo-800 rounded mt-2">
                    {garment.category}
                  </span>
                )}
                {garment.notes && (
                  <p className="text-gray-700 mt-2">{garment.notes}</p>
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
          Upload Image
        </label>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Image Type
            </label>
            <select
              value={uploadImageType}
              onChange={(e) => setUploadImageType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
            >
              <option value="flat_lay">Flat Lay</option>
              <option value="on_model">On Model</option>
              <option value="detail">Detail</option>
              <option value="front">Front</option>
              <option value="back">Back</option>
              <option value="side">Side</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image) => (
          <div key={image.id} className="relative border border-gray-200 rounded-lg overflow-hidden group">
            {signedUrls[image.id] ? (
              <img
                src={signedUrls[image.id]}
                alt={`${garment.name} image`}
                className="w-full h-64 object-contain bg-gray-100"
              />
            ) : (
              <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                Loading...
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              {image.is_primary && (
                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                  Primary
                </span>
              )}
              {image.image_type && (
                <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">
                  {image.image_type}
                </span>
              )}
            </div>
            <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity space-y-2">
              {!image.is_primary && (
                <button
                  onClick={() => handleSetPrimary(image.id)}
                  className="w-full px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                  title="Set as primary image"
                >
                  Set Primary
                </button>
              )}
              <select
                value={image.image_type || ''}
                onChange={(e) => handleImageTypeChange(image.id, e.target.value)}
                className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Select type...</option>
                <option value="flat_lay">Flat Lay</option>
                <option value="on_model">On Model</option>
                <option value="detail">Detail</option>
                <option value="front">Front</option>
                <option value="back">Back</option>
                <option value="side">Side</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No images yet. Upload an image to get started.
        </div>
      )}
    </div>
  )
}

