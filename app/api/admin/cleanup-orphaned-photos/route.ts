import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, getCurrentProfile } from '@/lib/auth'

/**
 * Cleanup endpoint to identify and optionally delete orphaned actor photo and garment image records.
 * Orphaned records are database entries that reference files that no longer exist in storage.
 * 
 * GET: List orphaned records
 * DELETE: Delete orphaned records (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const profile = await getCurrentProfile()
    
    // Only admins can access this endpoint
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Get all actor photos
    const { data: actorPhotos, error: actorPhotosError } = await supabase
      .from('actor_photos')
      .select('id, storage_path, actor_id')
    
    if (actorPhotosError) throw actorPhotosError
    
    // Get all garment images
    const { data: garmentImages, error: garmentImagesError } = await supabase
      .from('garment_images')
      .select('id, storage_path, garment_id')
    
    if (garmentImagesError) throw garmentImagesError
    
    // Check which files exist in storage
    const orphanedActorPhotos: any[] = []
    const orphanedGarmentImages: any[] = []
    
    // Check actor photos
    for (const photo of actorPhotos || []) {
      const pathParts = photo.storage_path.split('/')
      const folder = pathParts.slice(0, -1).join('/')
      const fileName = pathParts[pathParts.length - 1]
      
      const { data: files, error: listError } = await adminSupabase.storage
        .from('actors')
        .list(folder || '', {
          limit: 1000,
          search: fileName
        })
      
      if (listError) {
        console.error('[Cleanup] Error listing files:', { path: photo.storage_path, error: listError })
        continue
      }
      
      const fileExists = files?.some(f => f.name === fileName)
      if (!fileExists) {
        orphanedActorPhotos.push(photo)
      }
    }
    
    // Check garment images
    for (const image of garmentImages || []) {
      const pathParts = image.storage_path.split('/')
      const folder = pathParts.slice(0, -1).join('/')
      const fileName = pathParts[pathParts.length - 1]
      
      const { data: files, error: listError } = await adminSupabase.storage
        .from('garments')
        .list(folder || '', {
          limit: 1000,
          search: fileName
        })
      
      if (listError) {
        console.error('[Cleanup] Error listing files:', { path: image.storage_path, error: listError })
        continue
      }
      
      const fileExists = files?.some(f => f.name === fileName)
      if (!fileExists) {
        orphanedGarmentImages.push(image)
      }
    }
    
    return NextResponse.json({
      orphanedActorPhotos,
      orphanedGarmentImages,
      summary: {
        totalActorPhotos: actorPhotos?.length || 0,
        orphanedActorPhotos: orphanedActorPhotos.length,
        totalGarmentImages: garmentImages?.length || 0,
        orphanedGarmentImages: orphanedGarmentImages.length
      }
    })
  } catch (error: any) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    const profile = await getCurrentProfile()
    
    // Only admins can delete orphaned records
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const supabase = await createClient()
    
    // First, get the list of orphaned records
    const getResponse = await GET(request)
    if (!getResponse.ok) {
      return getResponse
    }
    
    const { orphanedActorPhotos, orphanedGarmentImages } = await getResponse.json()
    
    // Delete orphaned actor photos
    const deletedActorPhotos: string[] = []
    if (orphanedActorPhotos && orphanedActorPhotos.length > 0) {
      const photoIds = orphanedActorPhotos.map((p: any) => p.id)
      
      // Check if any are used in saved try-ons (shouldn't happen, but check anyway)
      const { data: jobsWithLookItems } = await supabase
        .from('tryon_jobs')
        .select('id, look_items!inner(id)')
        .in('actor_photo_id', photoIds)
      
      if (jobsWithLookItems && jobsWithLookItems.length > 0) {
        return NextResponse.json(
          { 
            error: 'Cannot delete: Some orphaned photos are still referenced by saved try-ons',
            count: jobsWithLookItems.length
          },
          { status: 409 }
        )
      }
      
      // Safe to delete - they're orphaned and not in saved try-ons
      const { error: deleteError } = await supabase
        .from('actor_photos')
        .delete()
        .in('id', photoIds)
      
      if (deleteError) {
        throw deleteError
      }
      
      deletedActorPhotos.push(...photoIds)
    }
    
    // Delete orphaned garment images
    const deletedGarmentImages: string[] = []
    if (orphanedGarmentImages && orphanedGarmentImages.length > 0) {
      const imageIds = orphanedGarmentImages.map((i: any) => i.id)
      
      // Check if any are used in saved try-ons
      const { data: jobsWithLookItems } = await supabase
        .from('tryon_jobs')
        .select('id, look_items!inner(id)')
        .in('garment_image_id', imageIds)
      
      if (jobsWithLookItems && jobsWithLookItems.length > 0) {
        return NextResponse.json(
          { 
            error: 'Cannot delete: Some orphaned images are still referenced by saved try-ons',
            count: jobsWithLookItems.length
          },
          { status: 409 }
        )
      }
      
      // Safe to delete
      const { error: deleteError } = await supabase
        .from('garment_images')
        .delete()
        .in('id', imageIds)
      
      if (deleteError) {
        throw deleteError
      }
      
      deletedGarmentImages.push(...imageIds)
    }
    
    return NextResponse.json({
      success: true,
      deleted: {
        actorPhotos: deletedActorPhotos.length,
        garmentImages: deletedGarmentImages.length
      },
      deletedActorPhotoIds: deletedActorPhotos,
      deletedGarmentImageIds: deletedGarmentImages
    })
  } catch (error: any) {
    console.error('[Cleanup] Error deleting orphaned records:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
