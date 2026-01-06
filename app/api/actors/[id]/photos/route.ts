import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { randomUUID } from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('actor_photos')
      .select('*')
      .eq('actor_id', params.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // Generate unique path
    const fileExt = file.name.split('.').pop()
    const fileName = `${randomUUID()}.${fileExt}`
    const storagePath = `${params.id}/${fileName}`
    
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload to storage
    const uploadedPath = await uploadFile('actors', storagePath, buffer)
    if (!uploadedPath) {
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }
    
    // Get image dimensions (optional, can be done client-side or with sharp)
    const isPrimary = formData.get('is_primary') === 'true'
    
    // Insert record
    const { data, error } = await supabase
      .from('actor_photos')
      .insert({
        actor_id: params.id,
        storage_path: uploadedPath,
        is_primary: isPrimary,
      })
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error uploading actor photo:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null,
      code: error.code || null
    }, { status: 500 })
  }
}

