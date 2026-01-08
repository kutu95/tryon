import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { downloadFile, uploadFile } from '@/lib/storage'
import { tuneGarmentPhoto, type OpenAIImageOptions } from '@/lib/server/openaiImage'
import { processImageForUpload } from '@/lib/server/imageProcessing'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs' // Ensure Node.js runtime for OpenAI

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    
    // Verify garment image exists and user has access
    const { data: image, error: imageError } = await supabase
      .from('garment_images')
      .select('*')
      .eq('id', params.imageId)
      .eq('garment_id', params.id)
      .single()
    
    if (imageError || !image) {
      return NextResponse.json({ error: 'Garment image not found' }, { status: 404 })
    }
    
    // Parse OpenAI options from request body
    const body = await request.json()
    const openaiOptions: OpenAIImageOptions = {
      model: body.model || 'gpt-image-1-mini',
      quality: body.quality || 'medium',
      size: body.size || '1024x1024',
      requestId: `garment-tune-${params.imageId}-${Date.now()}`,
      timeoutMs: 90000,
      retries: 2,
    }
    
    // Download original image
    const originalImage = await downloadFile('garments', image.storage_path)
    if (!originalImage) {
      return NextResponse.json({ error: 'Failed to download original image' }, { status: 500 })
    }
    
    const originalBuffer = Buffer.from(await originalImage.arrayBuffer())
    
    // Process image to ensure RGBA format and under 4MB (in case it's an old upload)
    const imageBuffer = await processImageForUpload(originalBuffer)
    
    // OpenAI images.edit only supports square sizes: '256x256', '512x512', '1024x1024'
    // Always use 1024x1024 for best quality
    const finalOptions = { ...openaiOptions, size: '1024x1024' as const }
    
    // Tune the image with OpenAI
    let tunedResult: { image: Buffer; mask?: Buffer }
    try {
      tunedResult = await tuneGarmentPhoto(imageBuffer, finalOptions)
    } catch (error: any) {
      console.error('[API] Error tuning garment image:', error)
      return NextResponse.json(
        { error: `Failed to tune image: ${error.message}` },
        { status: 500 }
      )
    }
    
    // Save tuned image as a new variant (PNG to preserve transparency)
    const fileName = `${randomUUID()}.png`
    const storagePath = `${params.id}/${fileName}`
    
    const uploadedPath = await uploadFile('garments', storagePath, tunedResult.image)
    if (!uploadedPath) {
      return NextResponse.json({ error: 'Failed to upload tuned image' }, { status: 500 })
    }
    
    // Create new image record with metadata
    const { data: newImage, error: insertError } = await supabase
      .from('garment_images')
      .insert({
        garment_id: params.id,
        storage_path: uploadedPath,
        image_type: image.image_type || 'cutout',
        parent_image_id: params.imageId,
        metadata: {
          source: 'openai',
          model: openaiOptions.model,
          quality: openaiOptions.quality,
          size: openaiOptions.size,
          createdAt: new Date().toISOString(),
          parentImageId: params.imageId,
          hasTransparency: true,
        },
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('[API] Error creating tuned image record:', insertError)
      return NextResponse.json(
        { error: 'Failed to create image record' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(newImage, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error in tune garment image:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
