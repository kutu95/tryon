import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { processImageForUpload } from '@/lib/server/imageProcessing'
import { randomUUID } from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('garment_images')
      .select('*')
      .eq('garment_id', params.id)
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
    
    // Generate unique path (always PNG after processing)
    const fileName = `${randomUUID()}.png`
    const storagePath = `${params.id}/${fileName}`
    
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)
    
    // Process image: convert to PNG and ensure under 4MB
    let processedBuffer: Buffer
    try {
      processedBuffer = await processImageForUpload(originalBuffer)
    } catch (error: any) {
      console.error('[API] Error processing image:', error)
      return NextResponse.json(
        { error: `Failed to process image: ${error.message}` },
        { status: 400 }
      )
    }
    
    // Upload to storage
    const uploadedPath = await uploadFile('garments', storagePath, processedBuffer)
    if (!uploadedPath) {
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }
    
    const imageType = formData.get('image_type') as string || 'flat_lay'
    
    // Insert record
    const { data, error } = await supabase
      .from('garment_images')
      .insert({
        garment_id: params.id,
        storage_path: uploadedPath,
        image_type: imageType,
      })
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

