/**
 * Image Processing Utilities
 * Server-only module for image conversion and optimization
 */

import sharp from 'sharp'

const MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB
const MAX_DIMENSION = 4096 // Max dimension for initial processing
const TARGET_MAX_DIMENSION = 2048 // Target max dimension for OpenAI (smaller = smaller file size)

/**
 * Process and normalize image: convert to PNG and ensure under 4MB
 * Returns optimized PNG buffer
 */
export async function processImageForUpload(input: Buffer): Promise<Buffer> {
  let processed = sharp(input)
  
  // Auto-rotate based on EXIF orientation (if present)
  processed = processed.rotate() // Auto-rotates based on EXIF data
  
  // Get image metadata after rotation
  const metadata = await processed.metadata()
  const currentWidth = metadata.width || 0
  const currentHeight = metadata.height || 0
  
  // Resize if too large - preserve aspect ratio
  const targetDimension = Math.min(MAX_DIMENSION, TARGET_MAX_DIMENSION)
  if (currentWidth > targetDimension || currentHeight > targetDimension) {
    // Preserve aspect ratio by using fit: 'inside'
    processed = processed.resize(targetDimension, targetDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  } else if (currentWidth > TARGET_MAX_DIMENSION || currentHeight > TARGET_MAX_DIMENSION) {
    // Even if under max, resize to target for better file size, preserving aspect ratio
    processed = processed.resize(TARGET_MAX_DIMENSION, TARGET_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  
  // Convert to PNG with RGBA format (required by OpenAI)
  // Force RGBA by ensuring alpha channel and using raw RGBA conversion
  // First ensure we have RGBA channels, then encode as PNG
  // Preserve aspect ratio and orientation
  const rgbaBuffer = await processed
    .ensureAlpha() // Add alpha channel if missing
    .raw() // Convert to raw RGBA buffer first
    .toBuffer({ resolveWithObject: true })
  
  // Now encode as PNG with explicit RGBA format (4 channels)
  // Preserve original dimensions to maintain aspect ratio
  let output = await sharp(rgbaBuffer.data, {
    raw: {
      width: rgbaBuffer.info.width,
      height: rgbaBuffer.info.height,
      channels: 4 // Explicitly RGBA (4 channels)
    }
  })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer()
  
  // If still too large, progressively reduce dimensions more aggressively
  let targetSize = TARGET_MAX_DIMENSION
  let attempts = 0
  const maxAttempts = 20
  
  // Calculate aspect ratio from original metadata (after rotation)
  const aspectRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 1
  
  while (output.length > MAX_SIZE_BYTES && targetSize >= 512 && attempts < maxAttempts) {
    attempts++
    targetSize = Math.floor(targetSize * 0.85) // Reduce by 15% each time
    
    // Calculate dimensions preserving aspect ratio
    let resizeWidth = targetSize
    let resizeHeight = targetSize
    if (aspectRatio > 1) {
      // Landscape: width is larger
      resizeWidth = targetSize
      resizeHeight = Math.floor(targetSize / aspectRatio)
    } else if (aspectRatio < 1) {
      // Portrait: height is larger
      resizeWidth = Math.floor(targetSize * aspectRatio)
      resizeHeight = targetSize
    }
    
    const resizedRgba = await sharp(input)
      .rotate() // Auto-rotate based on EXIF
      .resize(resizeWidth, resizeHeight, { fit: 'inside', withoutEnlargement: true })
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
  }
  
  // Last resort: use even smaller dimensions if still too large, preserving aspect ratio
  if (output.length > MAX_SIZE_BYTES) {
    // Calculate final dimensions preserving aspect ratio
    let finalWidth = 1024
    let finalHeight = 1024
    if (aspectRatio > 1) {
      // Landscape
      finalWidth = 1024
      finalHeight = Math.floor(1024 / aspectRatio)
    } else if (aspectRatio < 1) {
      // Portrait
      finalWidth = Math.floor(1024 * aspectRatio)
      finalHeight = 1024
    }
    
    const finalRgba = await sharp(input)
      .rotate() // Auto-rotate based on EXIF
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
  }
  
  if (output.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large even after compression: ${(output.length / 1024 / 1024).toFixed(2)} MB`)
  }
  
  return output
}

/**
 * Pad image to square while preserving aspect ratio
 * Adds transparent padding to make the image square
 */
export async function padImageToSquare(input: Buffer, aspectRatio: number): Promise<Buffer> {
  const metadata = await sharp(input).metadata()
  const width = metadata.width || 1024
  const height = metadata.height || 1024
  
  // Calculate target square size (use the larger dimension)
  const squareSize = Math.max(width, height)
  
  // Calculate padding needed
  const padLeft = Math.floor((squareSize - width) / 2)
  const padTop = Math.floor((squareSize - height) / 2)
  const padRight = squareSize - width - padLeft
  const padBottom = squareSize - height - padTop
  
  // Pad image to square with transparent background
  const padded = await sharp(input)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent padding
    })
    .png()
    .toBuffer()
  
  return padded
}

/**
 * Crop image back to original aspect ratio after OpenAI processing
 * Removes padding that was added to make it square
 */
export async function cropToAspectRatio(input: Buffer, targetAspectRatio: number): Promise<Buffer> {
  const metadata = await sharp(input).metadata()
  const width = metadata.width || 1024
  const height = metadata.height || 1024
  const currentAspectRatio = width / height
  
  if (Math.abs(currentAspectRatio - targetAspectRatio) < 0.01) {
    // Already at correct aspect ratio
    return input
  }
  
  let cropWidth = width
  let cropHeight = height
  let left = 0
  let top = 0
  
  if (currentAspectRatio > targetAspectRatio) {
    // Current is wider - crop width
    cropWidth = Math.floor(height * targetAspectRatio)
    left = Math.floor((width - cropWidth) / 2)
  } else {
    // Current is taller - crop height
    cropHeight = Math.floor(width / targetAspectRatio)
    top = Math.floor((height - cropHeight) / 2)
  }
  
  // Crop to target aspect ratio
  const cropped = await sharp(input)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer()
  
  return cropped
}
