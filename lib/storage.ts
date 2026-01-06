import { createAdminClient } from './supabase/admin'

export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  
  if (error) {
    console.error('Error creating signed URL:', error)
    return null
  }
  
  return data.signedUrl
}

export async function uploadFile(bucket: string, path: string, file: File | Buffer): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true
    })
  
  if (error) {
    console.error('Error uploading file:', error)
    return null
  }
  
  return data.path
}

export async function downloadFile(bucket: string, path: string): Promise<Blob | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path)
  
  if (error) {
    console.error('Error downloading file:', error)
    return null
  }
  
  return data
}

