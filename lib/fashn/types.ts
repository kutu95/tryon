/**
 * FASHN API Types and Validation
 * 
 * This module defines the types and validation schemas for FASHN Virtual Try-On v1.6 API
 */

import { z } from 'zod'

// Request parameter schemas
export const CategorySchema = z.enum(['auto', 'tops', 'bottoms', 'one-pieces'])
export type Category = z.infer<typeof CategorySchema>

export const ModeSchema = z.enum(['performance', 'balanced', 'quality'])
export type Mode = z.infer<typeof ModeSchema>

export const GarmentPhotoTypeSchema = z.enum(['auto', 'model', 'flat-lay'])
export type GarmentPhotoType = z.infer<typeof GarmentPhotoTypeSchema>

export const ModerationLevelSchema = z.enum(['permissive', 'conservative', 'none'])
export type ModerationLevel = z.infer<typeof ModerationLevelSchema>

export const OutputFormatSchema = z.enum(['png', 'jpg'])
export type OutputFormat = z.infer<typeof OutputFormatSchema>

// Main request schema
export const TryOnRequestSchema = z.object({
  // Required
  model_image: z.string().url().or(z.string().startsWith('data:image/')),
  garment_image: z.string().url().or(z.string().startsWith('data:image/')),
  
  // Optional parameters with defaults
  category: CategorySchema.optional().default('auto'),
  mode: ModeSchema.optional().default('balanced'),
  seed: z.number().int().min(0).max(2147483647).optional(),
  num_samples: z.number().int().min(1).max(4).optional().default(1),
  garment_photo_type: GarmentPhotoTypeSchema.optional().default('auto'),
  segmentation_free: z.boolean().optional().default(true),
  moderation_level: ModerationLevelSchema.optional().default('permissive'),
  
  // Output options (if supported by API)
  output_format: OutputFormatSchema.optional().default('png'),
  return_base64: z.boolean().optional().default(false),
})

export type TryOnRequest = z.infer<typeof TryOnRequestSchema>

// Response types
export interface TryOnResult {
  imageUrl?: string
  base64?: string
  seed: number
  params: Partial<TryOnRequest>
  createdAt: string
  requestId: string
}

export interface TryOnResponse {
  results: TryOnResult[]
  requestId: string
  duration?: number
  jobId?: string  // For async jobs
  isAsync?: boolean  // Indicates if this is an async job that needs polling
}

// Error types
export interface TryOnError {
  code: 'MISSING_IMAGES' | 'INVALID_INPUT' | 'MODERATION_REJECTED' | 'API_TIMEOUT' | 'RATE_LIMIT' | 'API_ERROR' | 'UNKNOWN'
  message: string
  details?: any
}

// Extensibility hooks (for future features)
export interface ProductToModelRequest {
  // TODO: Define when implementing product-to-model endpoint
  prompt?: string
  model_image?: string
  garment_image?: string
  // ... other params
}

export interface ModelSwapRequest {
  // TODO: Define when implementing model swap endpoint
  source_model_image: string
  target_model_image: string
  // ... other params
}

