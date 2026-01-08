import { PhotoKind, PhotoIssue, PhotoAnalysisPartial } from './types'

// Thresholds (tuneable constants)
const THRESHOLDS = {
  resolution: {
    fail: 800,   // long edge < 800px => FAIL
    warn: 1200,  // long edge < 1200px => WARN
  },
  blur: {
    warn: 100,   // variance below this => WARN
    fail: 50,    // variance below this => FAIL
  },
  brightness: {
    min: 0.15,   // mean luminance < this => WARN
    max: 0.85,   // mean luminance > this => WARN
    clippedWarn: 0.05, // > 5% clipped highlights/shadows => WARN
  },
  edgeDensity: {
    warn: 0.3,   // edge density above this => WARN (clutter)
  },
  aspectRatio: {
    tooNarrow: 0.4,  // width/height < this => WARN
    tooWide: 2.5,    // width/height > this => WARN
  },
}

export async function analyzePhotoClient(
  fileOrImage: File | Blob | HTMLImageElement,
  kind: PhotoKind
): Promise<PhotoAnalysisPartial> {
  const issues: PhotoIssue[] = []
  const metrics: Record<string, number> = {}

  try {
    // Load image
    let image: HTMLImageElement
    if (fileOrImage instanceof HTMLImageElement) {
      image = fileOrImage
    } else {
      image = await loadImageFromBlob(fileOrImage)
    }

    const { width, height } = image
    const longEdge = Math.max(width, height)
    const aspectRatio = width / height

    metrics.resolution_width = width
    metrics.resolution_height = height
    metrics.resolution_longEdge = longEdge
    metrics.aspectRatio = aspectRatio

    // Check resolution
    if (longEdge < THRESHOLDS.resolution.fail) {
      issues.push({
        id: 'resolution-too-low',
        severity: 'fail',
        message: kind === 'actor' 
          ? 'Photo resolution is too low for accurate try-on'
          : 'Image resolution is too low for accurate cutout',
        fix: 'Use a camera or phone with at least 1200px on the longest side',
        metric: longEdge,
      })
    } else if (longEdge < THRESHOLDS.resolution.warn) {
      issues.push({
        id: 'resolution-low',
        severity: 'warn',
        message: kind === 'actor'
          ? 'Photo resolution may be too low for best results'
          : 'Image resolution may be too low for best results',
        fix: 'Use a higher resolution photo (at least 1200px recommended)',
        metric: longEdge,
      })
    }

    // Check aspect ratio
    if (aspectRatio < THRESHOLDS.aspectRatio.tooNarrow) {
      issues.push({
        id: 'aspect-too-narrow',
        severity: 'warn',
        message: 'Photo is very narrow (portrait orientation)',
        fix: kind === 'actor'
          ? 'Ensure the full upper body is visible. Consider a wider crop if needed.'
          : 'Ensure the full garment is visible in frame.',
        metric: aspectRatio,
      })
    } else if (aspectRatio > THRESHOLDS.aspectRatio.tooWide) {
      issues.push({
        id: 'aspect-too-wide',
        severity: 'warn',
        message: 'Photo is very wide (landscape orientation)',
        fix: kind === 'actor'
          ? 'Ensure the person fills the frame appropriately.'
          : 'Ensure the garment fills the frame appropriately.',
        metric: aspectRatio,
      })
    }

    // Analyze image quality using canvas
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(width, 512)
    canvas.height = Math.min(height, 512)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { issues, metrics }
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Calculate blur (variance of Laplacian)
    const blurScore = calculateBlurScore(imageData)
    metrics.blurScore = blurScore

    if (blurScore < THRESHOLDS.blur.fail) {
      issues.push({
        id: 'blur-severe',
        severity: 'fail',
        message: 'Photo appears very blurry',
        fix: 'Take a new photo with steady hands or use a tripod. Ensure the camera is in focus.',
        metric: blurScore,
      })
    } else if (blurScore < THRESHOLDS.blur.warn) {
      issues.push({
        id: 'blur-moderate',
        severity: 'warn',
        message: 'Photo may be slightly blurry',
        fix: 'Ensure the camera is in focus and there is no motion blur.',
        metric: blurScore,
      })
    }

    // Calculate brightness and clipping
    let sumLuminance = 0
    let clippedHighlights = 0
    let clippedShadows = 0
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      sumLuminance += luminance

      if (r > 250 && g > 250 && b > 250) clippedHighlights++
      if (r < 5 && g < 5 && b < 5) clippedShadows++
    }

    const meanLuminance = sumLuminance / pixelCount
    const clippedHighlightsPct = clippedHighlights / pixelCount
    const clippedShadowsPct = clippedShadows / pixelCount

    metrics.meanLuminance = meanLuminance
    metrics.clippedHighlights = clippedHighlightsPct
    metrics.clippedShadows = clippedShadowsPct

    if (meanLuminance < THRESHOLDS.brightness.min) {
      issues.push({
        id: 'brightness-too-dark',
        severity: 'warn',
        message: 'Photo is too dark',
        fix: 'Improve lighting or increase exposure. Ensure the subject is well-lit.',
        metric: meanLuminance,
      })
    } else if (meanLuminance > THRESHOLDS.brightness.max) {
      issues.push({
        id: 'brightness-too-bright',
        severity: 'warn',
        message: 'Photo is too bright or overexposed',
        fix: 'Reduce lighting or decrease exposure. Avoid direct bright light sources.',
        metric: meanLuminance,
      })
    }

    if (clippedHighlightsPct > THRESHOLDS.brightness.clippedWarn || clippedShadowsPct > THRESHOLDS.brightness.clippedWarn) {
      issues.push({
        id: 'brightness-clipped',
        severity: 'warn',
        message: 'Photo has overexposed or underexposed areas',
        fix: 'Adjust lighting to avoid extreme highlights or shadows. Use even, diffused lighting.',
        metric: Math.max(clippedHighlightsPct, clippedShadowsPct),
      })
    }

    // Calculate edge density (simple Sobel approximation)
    const edgeDensity = calculateEdgeDensity(imageData)
    metrics.edgeDensity = edgeDensity

    if (edgeDensity > THRESHOLDS.edgeDensity.warn) {
      issues.push({
        id: 'clutter-high',
        severity: 'warn',
        message: kind === 'actor'
          ? 'Photo may have a busy or cluttered background'
          : 'Image may have a busy or cluttered background',
        fix: kind === 'actor'
          ? 'Use a plain, uncluttered background for best results.'
          : 'Use a plain, contrasting background for easier cutout.',
        metric: edgeDensity,
      })
    }

    // Kind-specific checks
    if (kind === 'actor') {
      // Check if image is too small (person might be too far)
      if (longEdge < 1500 && width < 800) {
        issues.push({
          id: 'actor-too-small',
          severity: 'warn',
          message: 'Person may be too small in frame',
          fix: 'Move closer or zoom in to ensure the person fills more of the frame.',
          metric: longEdge,
        })
      }
    } else if (kind === 'garment') {
      // Check if image might be too small for garment
      if (longEdge < 1000) {
        issues.push({
          id: 'garment-too-small',
          severity: 'warn',
          message: 'Garment may be too small in frame',
          fix: 'Ensure the garment fills most of the frame for better cutout accuracy.',
          metric: longEdge,
        })
      }
    }

  } catch (error) {
    console.error('Error in client-side photo analysis:', error)
    issues.push({
      id: 'analysis-error',
      severity: 'warn',
      message: 'Could not complete quick analysis',
      fix: 'Please try again or proceed with upload.',
    })
  }

  return { issues, metrics }
}

// Helper: Load image from Blob/File
function loadImageFromBlob(blob: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

// Helper: Calculate blur score using variance of Laplacian
function calculateBlurScore(imageData: ImageData): number {
  const { data, width, height } = imageData
  const laplacianKernel = [
    [0, -1, 0],
    [-1, 4, -1],
    [0, -1, 0],
  ]

  const laplacianValues: number[] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          sum += gray * laplacianKernel[ky + 1][kx + 1]
        }
      }
      laplacianValues.push(Math.abs(sum))
    }
  }

  // Calculate variance
  const mean = laplacianValues.reduce((a, b) => a + b, 0) / laplacianValues.length
  const variance = laplacianValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / laplacianValues.length

  return variance
}

// Helper: Calculate edge density (simple Sobel approximation)
function calculateEdgeDensity(imageData: ImageData): number {
  const { data, width, height } = imageData
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ]
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ]

  let edgePixels = 0
  const threshold = 30 // Edge detection threshold

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0
      let gy = 0

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          gx += gray * sobelX[ky + 1][kx + 1]
          gy += gray * sobelY[ky + 1][kx + 1]
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy)
      if (magnitude > threshold) {
        edgePixels++
      }
    }
  }

  return edgePixels / ((width - 2) * (height - 2))
}
