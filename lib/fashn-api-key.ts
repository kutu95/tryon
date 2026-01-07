import { createClient } from './supabase/server'

/**
 * Get FASHN API key from database or fallback to environment variable
 * This allows the API key to be updated without restarting the server
 */
export async function getFashnApiKey(): Promise<string | null> {
  try {
    const supabase = await createClient()
    
    // Try to get from database first
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'fashn_api_key')
      .single()
    
    if (!error && data?.value) {
      return data.value
    }
    
    // Fallback to environment variable (for initial setup)
    return process.env.FASHN_API_KEY || null
  } catch (error) {
    console.error('Error fetching FASHN API key from database:', error)
    // Fallback to environment variable
    return process.env.FASHN_API_KEY || null
  }
}

