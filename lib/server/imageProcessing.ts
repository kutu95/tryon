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
  
  // Convert to PNG and compress
  let output = await processed.png({ quality: 90, compressionLevel: 9 }).toBuffer()
  
  // If still too large, reduce quality progressively
  let quality = 90
  while (output.length > MAX_SIZE_BYTES && quality > 50) {
    quality -= 10
    output = await sharp(input)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .png({ quality, compressionLevel: 9 })
      .toBuffer()
  }
  
  // If still too large, reduce dimensions
  let scale = 0.9
  while (output.length > MAX_SIZE_BYTES && scale > 0.5) {
    const newWidth = Math.floor((metadata.width || 1024) * scale)
    const newHeight = Math.floor((metadata.height || 1024) * scale)
    output = await sharp(input)
      .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer()
    scale -= 0.1
  }
  
  if (output.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large even after compression: ${(output.length / 1024 / 1024).toFixed(2)} MB`)
  }
  
  return output
}
