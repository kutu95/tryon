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
  // Use compression level 6 for better size/quality balance (level 9 can be larger)
  let output = await sharp(rgbaBuffer.data, {
    raw: {
      width: rgbaBuffer.info.width,
      height: rgbaBuffer.info.height,
      channels: 4 // Explicitly RGBA (4 channels)
    }
  })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer()
  
  // If still too large, progressively reduce dimensions
  let scale = 0.8
  let attempts = 0
  const maxAttempts = 15
  
  while (output.length > MAX_SIZE_BYTES && scale > 0.2 && attempts < maxAttempts) {
    attempts++
    const newWidth = Math.floor((metadata.width || 1024) * scale)
    const newHeight = Math.floor((metadata.height || 1024) * scale)
    
    // Ensure minimum dimensions
    if (newWidth < 512 || newHeight < 512) {
      // Last resort: use very small dimensions
      const finalWidth = Math.min(1024, newWidth)
      const finalHeight = Math.min(1024, newHeight)
      
      const finalRgba = await sharp(input)
        .resize(finalWidth, finalHeight, { fit: 'inside', withoutEnlargement: true })
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
        .png({ compressionLevel: 6, adaptiveFiltering: true })
        .toBuffer()
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
      .png({ compressionLevel: 6, adaptiveFiltering: true })
      .toBuffer()
    
    // Reduce scale more aggressively if still too large
    if (output.length > MAX_SIZE_BYTES) {
      scale -= 0.1 // Progressive reduction
    } else {
      break
    }
  }
  
  if (output.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large even after compression: ${(output.length / 1024 / 1024).toFixed(2)} MB`)
  }
  
  return output
}
