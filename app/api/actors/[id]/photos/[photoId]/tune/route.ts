import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { downloadFile, uploadFile } from '@/lib/storage'
import { tuneActorPhoto, type OpenAIImageOptions } from '@/lib/server/openaiImage'
import { processImageForUpload } from '@/lib/server/imageProcessing'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs' // Ensure Node.js runtime for OpenAI

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    
    // Verify actor photo exists and user has access
    const { data: photo, error: photoError } = await supabase
      .from('actor_photos')
      .select('*')
      .eq('id', params.photoId)
      .eq('actor_id', params.id)
      .single()
    
    if (photoError || !photo) {
      return NextResponse.json({ error: 'Actor photo not found' }, { status: 404 })
    }
    
    // Parse OpenAI options from request body
    const body = await request.json()
    const openaiOptions: OpenAIImageOptions = {
      model: body.model || 'gpt-image-1-mini',
      quality: body.quality || 'medium',
      size: body.size || '1024x1024',
      requestId: `actor-tune-${params.photoId}-${Date.now()}`,
      timeoutMs: 90000,
      retries: 2,
    }
    
    // Download original photo
    const originalImage = await downloadFile('actors', photo.storage_path)
    if (!originalImage) {
      return NextResponse.json({ error: 'Failed to download original photo' }, { status: 500 })
    }
    
    const originalBuffer = Buffer.from(await originalImage.arrayBuffer())
    
    // Process image to ensure RGBA format and under 4MB (in case it's an old upload)
    const imageBuffer = await processImageForUpload(originalBuffer)
    
    // Calculate aspect ratio from processed image to match OpenAI size parameter
    const imageMetadata = await sharp(imageBuffer).metadata()
    const imageWidth = imageMetadata.width || 1024
    const imageHeight = imageMetadata.height || 1024
    const aspectRatio = imageWidth / imageHeight
    
    // Select size parameter that best matches the image aspect ratio
    // OpenAI sizes: '1024x1024' (1:1), '1024x1536' (2:3 portrait), '1536x1024' (3:2 landscape)
    let selectedSize: '1024x1024' | '1024x1536' | '1536x1024' = openaiOptions.size || '1024x1024'
    if (aspectRatio > 1.2) {
      // Landscape: use 3:2 ratio
      selectedSize = '1536x1024'
    } else if (aspectRatio < 0.8) {
      // Portrait: use 2:3 ratio
      selectedSize = '1024x1536'
    } else {
      // Square-ish: use 1:1 ratio
      selectedSize = '1024x1024'
    }
    
    // Override the size option with the calculated one
    const finalOptions = { ...openaiOptions, size: selectedSize }
    
    // Tune the photo with OpenAI
    let tunedBuffer: Buffer
    try {
      tunedBuffer = await tuneActorPhoto(imageBuffer, finalOptions)
    } catch (error: any) {
      console.error('[API] Error tuning actor photo:', error)
      return NextResponse.json(
        { error: `Failed to tune photo: ${error.message}` },
        { status: 500 }
      )
    }
    
    // Save tuned photo as a new variant
    const fileExt = photo.storage_path.split('.').pop() || 'png'
    const fileName = `${randomUUID()}.${fileExt}`
    const storagePath = `${params.id}/${fileName}`
    
    const uploadedPath = await uploadFile('actors', storagePath, tunedBuffer)
    if (!uploadedPath) {
      return NextResponse.json({ error: 'Failed to upload tuned photo' }, { status: 500 })
    }
    
    // Create new photo record with metadata
    const { data: newPhoto, error: insertError } = await supabase
      .from('actor_photos')
      .insert({
        actor_id: params.id,
        storage_path: uploadedPath,
        is_primary: false, // Don't make tuned variants primary by default
        parent_photo_id: params.photoId,
        metadata: {
          source: 'openai',
          model: openaiOptions.model,
          quality: openaiOptions.quality,
          size: openaiOptions.size,
          createdAt: new Date().toISOString(),
          parentPhotoId: params.photoId,
        },
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('[API] Error creating tuned photo record:', insertError)
      return NextResponse.json(
        { error: 'Failed to create photo record' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(newPhoto, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error in tune actor photo:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
