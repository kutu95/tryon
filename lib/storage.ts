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
  
  // Replace localhost or local IP URLs with public URL if needed
  // Signed URLs from Supabase use the same base URL as the client that created them
  const signedUrl = data.signedUrl
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (publicUrl) {
    // Replace localhost, 127.0.0.1, or private IP addresses with public URL
    const localhostPattern = /https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?/
    if (localhostPattern.test(signedUrl)) {
      return signedUrl.replace(localhostPattern, publicUrl)
    }
  }
  
  return signedUrl
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

