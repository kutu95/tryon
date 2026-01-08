import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { uploadFile, deleteFile } from '@/lib/storage'
import { processImageForUpload } from '@/lib/server/imageProcessing'
import { randomUUID } from 'crypto'
import { logAuditEvent, getRequestMetadata } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Get current profile to check for existing picture
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('profile_picture_path')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[API] Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    // Delete old profile picture if it exists
    if (currentProfile?.profile_picture_path) {
      await deleteFile('profiles', currentProfile.profile_picture_path)
    }
    
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
    
    // Generate unique path (always PNG after processing)
    const fileName = `${user.id}/${randomUUID()}.png`
    
    // Upload to storage
    const uploadedPath = await uploadFile('profiles', fileName, processedBuffer)
    if (!uploadedPath) {
      console.error('[API] Failed to upload file to profiles bucket')
      return NextResponse.json({ 
        error: 'Failed to upload file. Please ensure the "profiles" storage bucket exists.' 
      }, { status: 500 })
    }
    
    // Update profile with new picture path
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        profile_picture_path: uploadedPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()
    
    if (updateError) throw updateError

    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'profile_picture_updated',
      resource_type: 'profile',
      resource_id: user.id,
      details: { storage_path: uploadedPath },
      ...metadata,
    })
    
    return NextResponse.json(updatedProfile, { status: 200 })
  } catch (error: any) {
    console.error('Error uploading profile picture:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    // Get current profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('profile_picture_path')
      .eq('id', user.id)
      .single()

    // Delete profile picture from storage if it exists
    if (currentProfile?.profile_picture_path) {
      await deleteFile('profiles', currentProfile.profile_picture_path)
    }

    // Update profile to remove picture path
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        profile_picture_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()
    
    if (updateError) throw updateError

    // Log audit event
    const metadata = getRequestMetadata(request)
    await logAuditEvent({
      user_id: user.id,
      event_type: 'profile_picture_deleted',
      resource_type: 'profile',
      resource_id: user.id,
      ...metadata,
    })
    
    return NextResponse.json(updatedProfile, { status: 200 })
  } catch (error: any) {
    console.error('Error deleting profile picture:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

