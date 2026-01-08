import { PhotoKind, PhotoAnalysisResult, PhotoAnalysisPartial } from './types'
import { analyzePhotoClient } from './client'
import { combineAnalysis } from './combine'

/**
 * Analyze a photo with both client and server analysis
 */
export async function analyzePhoto(
  file: File,
  kind: PhotoKind
): Promise<PhotoAnalysisResult> {
  // Step 1: Client-side analysis (fast)
  const clientPartial = await analyzePhotoClient(file, kind)

  // Step 2: Server-side analysis (better detection)
  let serverPartial: PhotoAnalysisPartial | null = null
  try {
    // Downscale image to ~512px for server analysis
    const downscaledBase64 = await downscaleImageForAnalysis(file, 512)
    const image = await loadImageFromFile(file)
    
    const response = await fetch('/api/photo/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        imageBase64: downscaledBase64,
        width: image.width,
        height: image.height,
      }),
    })

    if (response.ok) {
      serverPartial = await response.json()
    } else {
      console.warn('Server analysis failed, using client-only results')
    }
  } catch (error) {
    console.warn('Server analysis error, using client-only results:', error)
    // Add a warning issue if server fails
    serverPartial = {
      issues: [{
        id: 'server-unavailable',
        severity: 'warn',
        message: 'Server analysis unavailable; using quick checks only',
        fix: 'Photo will be saved with basic quality checks.',
      }],
    }
  }

  // Step 3: Combine results
  return combineAnalysis(kind, clientPartial, serverPartial)
}

/**
 * Downscale image to max dimension and convert to base64
 */
async function downscaleImageForAnalysis(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Calculate new dimensions
      if (width > height) {
        if (width > maxDimension) {
          height = (height * maxDimension) / width
          width = maxDimension
        }
      } else {
        if (height > maxDimension) {
          width = (width * maxDimension) / height
          height = maxDimension
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      resolve(base64)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Load image from file to get dimensions
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
