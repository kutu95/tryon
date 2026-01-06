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
      .from('accessory_images')
      .select('*')
      .eq('accessory_id', params.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
    const files = formData.getAll('file') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    
    const results = []
    
    for (const file of files) {
      // Generate unique path
      const fileExt = file.name.split('.').pop()
      const fileName = `${randomUUID()}.${fileExt}`
      const storagePath = `${params.id}/${fileName}`
      
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Upload to storage
      const uploadedPath = await uploadFile('accessories', storagePath, buffer)
      if (!uploadedPath) {
        console.error(`Failed to upload file: ${file.name}`)
        continue
      }
      
      const imageType = formData.get('image_type') as string || 'flat_lay'
      
      // Insert record
      const { data, error } = await supabase
        .from('accessory_images')
        .insert({
          accessory_id: params.id,
          storage_path: uploadedPath,
          image_type: imageType,
        })
        .select()
        .single()
      
      if (error) {
        console.error(`Error inserting image record for ${file.name}:`, error)
        continue
      }
      
      results.push(data)
    }
    
    if (results.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any files' }, { status: 500 })
    }
    
    return NextResponse.json(results, { status: 201 })
  } catch (error: any) {
    console.error('Error uploading accessory images:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

