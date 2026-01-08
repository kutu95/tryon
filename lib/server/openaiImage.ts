/**
 * OpenAI Image Service
 * Server-only module for OpenAI image generation/editing operations
 */

import OpenAI from 'openai'

// Ensure this module only runs server-side
if (typeof window !== 'undefined') {
  throw new Error('openaiImage module must only be used server-side')
}

const getOpenAIClient = (): OpenAI | null => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[OpenAI] OPENAI_API_KEY not set, OpenAI features will be disabled')
    return null
  }
  return new OpenAI({ apiKey })
}

export interface OpenAIImageOptions {
  model: 'gpt-image-1-mini' | 'gpt-image-1'
  quality: 'low' | 'medium' | 'high'
  size: '1024x1024' | '1024x1536' | '1536x1024'
  requestId?: string
  timeoutMs?: number
  retries?: number
  maskExpandPx?: number
}

const DEFAULT_TIMEOUT_MS = 90000
const DEFAULT_RETRIES = 2

/**
 * Retry wrapper for OpenAI API calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_RETRIES,
  requestId?: string
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        console.warn(
          `[OpenAI] Attempt ${attempt + 1}/${maxRetries + 1} failed${requestId ? ` (requestId: ${requestId})` : ''}, retrying in ${delay}ms...`,
          error.message
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError || new Error('Unknown error in retry loop')
}

/**
 * Convert Buffer to base64 data URL
 */
function bufferToDataUrl(buffer: Buffer, mimeType: string = 'image/png'): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Download image from URL or data URL and return as Buffer
 */
async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith('data:')) {
    // Data URL
    const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
    if (!base64Match) {
      throw new Error('Invalid data URL format')
    }
    return Buffer.from(base64Match[1], 'base64')
  }
  
  // Regular URL
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Tune actor photo for virtual try-on catalog
 * Conservative enhancement: exposure, white balance, noise reduction, optional background cleanup
 */
export async function tuneActorPhoto(
  input: Buffer,
  opts: OpenAIImageOptions
): Promise<Buffer> {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error('OpenAI API key not configured')
  }

  const requestId = opts.requestId || `actor-tune-${Date.now()}`
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS

  const prompt = `Improve this actor photo for a virtual try-on catalog. Keep the same person and identity. Do NOT change face, body shape, pose, skin tone, tattoos, hair style, age, or clothing style. Only correct exposure and white balance, reduce noise, improve clarity slightly, and optionally simplify or clean the background to a neutral studio-like background. Maintain full photorealism. Do not add accessories or alter the scene.`

  try {
    const result = await withRetry(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        // OpenAI SDK accepts File, Blob, or Buffer
        // In Node.js, we can pass the Buffer directly or create a File-like object
        // Note: The actual API structure may vary - adjust based on OpenAI SDK version
        const response = await client.images.edit({
          model: opts.model,
          image: input, // Buffer should work, or we may need to convert to File
          prompt: prompt,
          n: 1,
          size: opts.size,
          response_format: 'b64_json',
        })

        clearTimeout(timeoutId)
        return response
      } catch (error: any) {
        clearTimeout(timeoutId)
        throw error
      }
    }, opts.retries || DEFAULT_RETRIES, requestId)

    if (!result.data || result.data.length === 0 || !result.data[0].b64_json) {
      throw new Error('No image data returned from OpenAI')
    }

    const base64Data = result.data[0].b64_json
    return Buffer.from(base64Data, 'base64')
  } catch (error: any) {
    console.error(`[OpenAI] Error tuning actor photo (${requestId}):`, error.message)
    throw new Error(`Failed to tune actor photo: ${error.message}`)
  }
}

/**
 * Tune garment photo: create clean product cutout with transparent background
 */
export async function tuneGarmentPhoto(
  input: Buffer,
  opts: OpenAIImageOptions
): Promise<{ image: Buffer; mask?: Buffer }> {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error('OpenAI API key not configured')
  }

  const requestId = opts.requestId || `garment-tune-${Date.now()}`
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS

  const prompt = `Create a clean product cutout of this garment. Remove the background completely (transparent). Preserve exact garment shape, proportions, textures, stitching, logos, patterns, and colors. Do NOT invent or modify details. Photorealistic, product-photo style.`

  try {
    const result = await withRetry(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        // OpenAI SDK accepts File, Blob, or Buffer
        // In Node.js, we can pass the Buffer directly or create a File-like object
        // Note: The actual API structure may vary - adjust based on OpenAI SDK version
        const response = await client.images.edit({
          model: opts.model,
          image: input, // Buffer should work, or we may need to convert to File
          prompt: prompt,
          n: 1,
          size: opts.size,
          response_format: 'b64_json',
        })

        clearTimeout(timeoutId)
        return response
      } catch (error: any) {
        clearTimeout(timeoutId)
        throw error
      }
    }, opts.retries || DEFAULT_RETRIES, requestId)

    if (!result.data || result.data.length === 0 || !result.data[0].b64_json) {
      throw new Error('No image data returned from OpenAI')
    }

    const base64Data = result.data[0].b64_json
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Note: OpenAI Images API doesn't return masks directly, but the edited image should have transparent background
    // If mask is needed, it would need to be generated separately or extracted from the image
    return { image: imageBuffer }
  } catch (error: any) {
    console.error(`[OpenAI] Error tuning garment photo (${requestId}):`, error.message)
    throw new Error(`Failed to tune garment photo: ${error.message}`)
  }
}

/**
 * Postprocess try-on result: fix minor artifacts only
 */
export async function postprocessTryOnImage(
  input: Buffer,
  opts: OpenAIImageOptions
): Promise<Buffer> {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error('OpenAI API key not configured')
  }

  const requestId = opts.requestId || `postprocess-${Date.now()}`
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS

  const prompt = `Fix ONLY minor visual artifacts such as jagged edges, halos, small seam blending issues, or slight lighting mismatches. Preserve the exact garment design, fit, pose, body shape, and face. Do NOT redesign or restyle anything. Maintain photorealism.`

  try {
    const result = await withRetry(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        // OpenAI SDK accepts File, Blob, or Buffer
        // In Node.js, we can pass the Buffer directly or create a File-like object
        // Note: The actual API structure may vary - adjust based on OpenAI SDK version
        const response = await client.images.edit({
          model: opts.model,
          image: input, // Buffer should work, or we may need to convert to File
          prompt: prompt,
          n: 1,
          size: opts.size,
          response_format: 'b64_json',
        })

        clearTimeout(timeoutId)
        return response
      } catch (error: any) {
        clearTimeout(timeoutId)
        throw error
      }
    }, opts.retries || DEFAULT_RETRIES, requestId)

    if (!result.data || result.data.length === 0 || !result.data[0].b64_json) {
      throw new Error('No image data returned from OpenAI')
    }

    const base64Data = result.data[0].b64_json
    return Buffer.from(base64Data, 'base64')
  } catch (error: any) {
    console.error(`[OpenAI] Error postprocessing try-on image (${requestId}):`, error.message)
    throw new Error(`Failed to postprocess try-on image: ${error.message}`)
  }
}
