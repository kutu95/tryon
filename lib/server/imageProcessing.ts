/**
 * Image Processing Utilities
 * Server-only module for image conversion and optimization
 */

import sharp from 'sharp'

const MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB
const MAX_DIMENSION = 4096 // Max dimension

/**
 * Process and normalize image: convert to PNG and ensure under 4MB
 * Returns optimized PNG buffer
 */
export async function processImageForUpload(input: Buffer): Promise<Buffer> {
  let processed = sharp(input)
  
  // Get image metadata
  const metadata = await processed.metadata()
  const currentWidth = metadata.width || 0
  const currentHeight = metadata.height || 0
  
  // Resize if too large
  if (currentWidth > MAX_DIMENSION || currentHeight > MAX_DIMENSION) {
    processed = processed.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  
  // Convert to PNG with RGBA format (required by OpenAI)
  // Force RGBA by ensuring alpha channel and using raw RGBA conversion
  // First ensure we have RGBA channels, then encode as PNG
  const rgbaBuffer = await processed
    .ensureAlpha() // Add alpha channel if missing
    .raw() // Convert to raw RGBA buffer first
    .toBuffer({ resolveWithObject: true })
  
  // Now encode as PNG with explicit RGBA format (4 channels)
  // Start with maximum compression
  let output = await sharp(rgbaBuffer.data, {
    raw: {
      width: rgbaBuffer.info.width,
      height: rgbaBuffer.info.height,
      channels: 4 // Explicitly RGBA (4 channels)
    }
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
  
  // If still too large, progressively reduce dimensions more aggressively
  let scale = 0.8
  let attempts = 0
  const maxAttempts = 10
  
  while (output.length > MAX_SIZE_BYTES && scale > 0.3 && attempts < maxAttempts) {
    attempts++
    const newWidth = Math.floor((metadata.width || 1024) * scale)
    const newHeight = Math.floor((metadata.height || 1024) * scale)
    
    // Ensure minimum dimensions
    if (newWidth < 256 || newHeight < 256) {
      break
    }
    
    const resizedRgba = await sharp(input)
      .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    output = await sharp(resizedRgba.data, {
      raw: {
        width: resizedRgba.info.width,
        height: resizedRgba.info.height,
        channels: 4 // Explicitly RGBA
      }
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
    
    // Reduce scale more aggressively if still too large
    if (output.length > MAX_SIZE_BYTES) {
      scale -= 0.15 // More aggressive reduction
    } else {
      break
    }
  }
  
  // Final check: if still too large, use lower compression level (slightly lower quality but smaller file)
  if (output.length > MAX_SIZE_BYTES) {
    const finalRgba = await sharp(input)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    output = await sharp(finalRgba.data, {
      raw: {
        width: finalRgba.info.width,
        height: finalRgba.info.height,
        channels: 4
      }
    })
      .png({ compressionLevel: 6, adaptiveFiltering: true }) // Lower compression for smaller file
      .toBuffer()
  }
  
  if (output.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large even after compression: ${(output.length / 1024 / 1024).toFixed(2)} MB`)
  }
  
  return output
}
