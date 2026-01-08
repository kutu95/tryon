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
  // Explicitly use toFormat to ensure RGBA with alpha channel
  let output = await processed
    .ensureAlpha() // Add alpha channel if missing
    .toFormat('png', { 
      quality: 90,
      compressionLevel: 9,
      palette: false // Force truecolor RGBA, not indexed color
    })
    .toBuffer()
  
  // Verify the image has 4 channels (RGBA)
  const outputMetadata = await sharp(output).metadata()
  if (outputMetadata.channels !== 4) {
    // Force RGBA conversion if not already 4 channels
    output = await sharp(output)
      .ensureAlpha()
      .toFormat('png', { quality: 90, compressionLevel: 9, palette: false })
      .toBuffer()
  }
  
  // If still too large, reduce quality progressively
  let quality = 90
  while (output.length > MAX_SIZE_BYTES && quality > 50) {
    quality -= 10
    output = await sharp(input)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .toFormat('png', { quality, compressionLevel: 9, palette: false })
      .toBuffer()
    
    // Verify RGBA format
    const checkMetadata = await sharp(output).metadata()
    if (checkMetadata.channels !== 4) {
      output = await sharp(output)
        .ensureAlpha()
        .toFormat('png', { quality, compressionLevel: 9, palette: false })
        .toBuffer()
    }
  }
  
  // If still too large, reduce dimensions
  let scale = 0.9
  while (output.length > MAX_SIZE_BYTES && scale > 0.5) {
    const newWidth = Math.floor((metadata.width || 1024) * scale)
    const newHeight = Math.floor((metadata.height || 1024) * scale)
    output = await sharp(input)
      .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .toFormat('png', { quality: 80, compressionLevel: 9, palette: false })
      .toBuffer()
    
    // Verify RGBA format
    const checkMetadata = await sharp(output).metadata()
    if (checkMetadata.channels !== 4) {
      output = await sharp(output)
        .ensureAlpha()
        .toFormat('png', { quality: 80, compressionLevel: 9, palette: false })
        .toBuffer()
    }
    scale -= 0.1
  }
  
  if (output.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large even after compression: ${(output.length / 1024 / 1024).toFixed(2)} MB`)
  }
  
  return output
}
