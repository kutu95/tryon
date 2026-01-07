/**
 * FASHN API Service Module
 * 
 * This module provides a clean interface to the FASHN Virtual Try-On v1.6 API
 * with support for all optional parameters and extensibility hooks.
 */

import { randomInt } from 'crypto'
import { getFashnApiKey } from '../fashn-api-key'
import { TryOnRequest, TryOnRequestSchema, TryOnResponse, TryOnResult, TryOnError } from './types'
import { ProductToModelRequest, ModelSwapRequest } from './types'

// Re-export types for convenience
export type { TryOnError, TryOnRequest, TryOnResponse, TryOnResult } from './types'

const FASHN_BASE_URL = process.env.FASHN_API_BASE_URL || 'https://api.fashn.ai/v1'

/**
 * Generate a cryptographically random seed if none provided
 * This function is only used server-side (in API routes)
 */
function generateSeed(): number {
  // Generate a random integer in a safe range (0 to 2^31 - 1)
  // Always use Node.js crypto since this is server-side only
  return randomInt(0, 2147483647)
}

/**
 * Run a try-on request with FASHN API
 * 
 * @param request - Try-on request parameters
 * @returns Promise with try-on results
 */
export async function runTryOn(request: TryOnRequest): Promise<TryOnResponse> {
  const startTime = Date.now()
  
  try {
    // Validate request
    const validatedRequest = TryOnRequestSchema.parse(request)
    
    // Generate seed if not provided
    const seed = validatedRequest.seed ?? generateSeed()
    
    // Get API key
    const apiKey = await getFashnApiKey()
    if (!apiKey) {
      throw new Error('FASHN_API_KEY not found. Please configure it in the Account page (admin only).')
    }
    
    // Prepare API request body
    const apiBody: any = {
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: validatedRequest.model_image,
        garment_image: validatedRequest.garment_image,
        category: validatedRequest.category,
        mode: validatedRequest.mode,
        seed: seed,
        num_samples: validatedRequest.num_samples,
        garment_photo_type: validatedRequest.garment_photo_type,
        segmentation_free: validatedRequest.segmentation_free,
        moderation_level: validatedRequest.moderation_level,
        output_format: validatedRequest.output_format,
      }
    }
    
    // Add return_base64 if supported and requested
    if (validatedRequest.return_base64) {
      apiBody.inputs.return_base64 = true
    }
    
    // Log request summary (never log image content)
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('[FASHN] Try-on request:', {
      requestId,
      category: validatedRequest.category,
      mode: validatedRequest.mode,
      seed,
      num_samples: validatedRequest.num_samples,
      garment_photo_type: validatedRequest.garment_photo_type,
      segmentation_free: validatedRequest.segmentation_free,
      moderation_level: validatedRequest.moderation_level,
      output_format: validatedRequest.output_format,
      return_base64: validatedRequest.return_base64,
    })
    
    // Make API call
    const response = await fetch(`${FASHN_BASE_URL}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      let error: any
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { message: errorText || response.statusText }
      }
      
      // Handle specific error cases
      if (response.status === 403 || response.status === 429) {
        throw {
          code: 'RATE_LIMIT' as const,
          message: 'Rate limit exceeded. Please try again later.',
          details: error
        } as TryOnError
      }
      
      if (response.status === 400 && (error.message?.includes('moderation') || error.message?.includes('content'))) {
        throw {
          code: 'MODERATION_REJECTED' as const,
          message: 'Content was rejected by moderation filters.',
          details: error
        } as TryOnError
      }
      
      throw {
        code: 'API_ERROR' as const,
        message: `FASHN API error (${response.status}): ${error.message || error.detail || errorText || response.statusText}`,
        details: error
      } as TryOnError
    }
    
    const data = await response.json()
    const duration = Date.now() - startTime
    
    // Parse response
    const results: TryOnResult[] = []
    
    // Handle different response formats
    if (data.output) {
      const outputs = Array.isArray(data.output) ? data.output : [data.output]
      
      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i]
        const resultSeed = seed + i // Use sequential seeds if multiple samples
        
        if (typeof output === 'string') {
          if (output.startsWith('http')) {
            results.push({
              imageUrl: output,
              seed: resultSeed,
              params: validatedRequest,
              createdAt: new Date().toISOString(),
              requestId: data.id || requestId,
            })
          } else if (output.startsWith('data:image/') || validatedRequest.return_base64) {
            results.push({
              base64: output.startsWith('data:image/') ? output : `data:image/${validatedRequest.output_format};base64,${output}`,
              seed: resultSeed,
              params: validatedRequest,
              createdAt: new Date().toISOString(),
              requestId: data.id || requestId,
            })
          }
        } else if (output?.url) {
          results.push({
            imageUrl: output.url,
            seed: resultSeed,
            params: validatedRequest,
            createdAt: new Date().toISOString(),
            requestId: data.id || requestId,
          })
        }
      }
    } else if (data.result || data.image_url) {
      // Single result
      results.push({
        imageUrl: data.result || data.image_url,
        seed: seed,
        params: validatedRequest,
        createdAt: new Date().toISOString(),
        requestId: data.id || requestId,
      })
    }
    
    // Check if this is an async job (has job ID but no immediate results)
    const jobId = data.id || data.job_id || data.prediction_id
    if (jobId && results.length === 0) {
      // Async job - return job ID for polling
      console.log('[FASHN] Async job created:', {
        jobId,
        requestId: data.id || requestId,
      })
      
      return {
        results: [],
        requestId: data.id || requestId,
        duration,
        jobId,
        isAsync: true,
      }
    }
    
    if (results.length === 0) {
      throw {
        code: 'API_ERROR' as const,
        message: 'No results returned from FASHN API',
        details: data
      } as TryOnError
    }
    
    console.log('[FASHN] Try-on completed:', {
      requestId: data.id || requestId,
      resultsCount: results.length,
      duration: `${duration}ms`,
    })
    
    return {
      results,
      requestId: data.id || requestId,
      duration,
      isAsync: false,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    if (error.code) {
      // Already a TryOnError
      throw error
    }
    
    if (error.name === 'ZodError') {
      throw {
        code: 'INVALID_INPUT' as const,
        message: 'Invalid request parameters',
        details: error.errors
      } as TryOnError
    }
    
    if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
      throw {
        code: 'API_TIMEOUT' as const,
        message: 'Request timed out. Please try again.',
        details: error
      } as TryOnError
    }
    
    throw {
      code: 'UNKNOWN' as const,
      message: error.message || 'Unknown error occurred',
      details: error
    } as TryOnError
  }
}

/**
 * Get try-on status for async jobs
 * 
 * @param jobId - Job ID from FASHN API
 * @returns Promise with job status and result if available
 */
export async function getTryOnStatus(jobId: string): Promise<{
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  resultUrl?: string
  error?: string
}> {
  const apiKey = await getFashnApiKey()
  if (!apiKey) {
    throw new Error('FASHN_API_KEY not found')
  }
  
  // Try /requests/{id} first, then fallback to /status/{id}
  let response = await fetch(`${FASHN_BASE_URL}/requests/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    response = await fetch(`${FASHN_BASE_URL}/status/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
  }
  
  if (!response.ok) {
    const errorText = await response.text()
    throw {
      code: 'API_ERROR' as const,
      message: `Failed to get job status: ${errorText || response.statusText}`,
    } as TryOnError
  }
  
  const data = await response.json()
  
  let status: 'queued' | 'running' | 'succeeded' | 'failed'
  if (data.status === 'succeeded' || data.status === 'completed' || data.status === 'done') {
    status = 'succeeded'
  } else if (data.status === 'failed' || data.status === 'error' || data.status === 'canceled') {
    status = 'failed'
  } else if (data.status === 'processing' || data.status === 'running' || data.status === 'in_progress') {
    status = 'running'
  } else {
    status = 'queued'
  }
  
  let resultUrl: string | undefined
  if (data.output) {
    if (Array.isArray(data.output) && data.output.length > 0) {
      resultUrl = data.output[0]
    } else if (typeof data.output === 'string') {
      resultUrl = data.output
    } else if (data.output.url) {
      resultUrl = data.output.url
    }
  }
  
  if (!resultUrl && status === 'succeeded' && jobId) {
    resultUrl = `https://cdn.fashn.ai/${jobId}/output_0.png`
  }
  
  if (!resultUrl) {
    resultUrl = data.result_url || data.image_url || data.url || data.result
  }
  
  return {
    status,
    resultUrl,
    error: status === 'failed' ? (data.error?.message || data.error || 'Try-on generation failed') : undefined,
  }
}

/**
 * TODO: Product-to-Model endpoint
 * This will support text prompts, accessories, and background control
 * 
 * @param request - Product-to-model request parameters
 * @returns Promise with results
 */
export async function runProductToModel(request: ProductToModelRequest): Promise<TryOnResponse> {
  // TODO: Implement when FASHN API supports product-to-model endpoint
  throw new Error('Product-to-model endpoint not yet implemented')
}

/**
 * TODO: Model Swap endpoint
 * This will support identity swapping between models
 * 
 * @param request - Model swap request parameters
 * @returns Promise with results
 */
export async function runModelSwap(request: ModelSwapRequest): Promise<TryOnResponse> {
  // TODO: Implement when FASHN API supports model swap endpoint
  throw new Error('Model swap endpoint not yet implemented')
}

