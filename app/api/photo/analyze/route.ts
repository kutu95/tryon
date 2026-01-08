import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { PhotoKind, PhotoAnalysisPartial } from '@/lib/photoAnalysis/types'
import sharp from 'sharp'

// Simple in-memory cache for analysis results (keyed by image hash)
const analysisCache = new Map<string, { result: PhotoAnalysisPartial; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export const runtime = 'nodejs'
export const maxDuration = 12 // 12 seconds timeout

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { kind, imageBase64, width, height } = body

    if (!kind || !imageBase64 || !width || !height) {
      return NextResponse.json(
        { error: 'kind, imageBase64, width, and height are required' },
        { status: 400 }
      )
    }

    if (kind !== 'actor' && kind !== 'garment') {
      return NextResponse.json(
        { error: 'kind must be "actor" or "garment"' },
        { status: 400 }
      )
    }

    // Check cache
    const cacheKey = `${kind}-${imageBase64.substring(0, 100)}`
    const cached = analysisCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.result)
    }

    // Decode base64 image
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    // Use sharp to analyze the image
    const metadata = await sharp(imageBuffer).metadata()
    const stats = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const issues: PhotoAnalysisPartial['issues'] = []
    const metrics: Record<string, number> = {
      server_width: metadata.width || width,
      server_height: metadata.height || height,
    }

    // Analyze image using sharp
    const pixels = stats.data
    const pixelCount = pixels.length

    // Calculate basic stats
    let sum = 0
    let min = 255
    let max = 0
    for (let i = 0; i < pixelCount; i++) {
      const val = pixels[i]
      sum += val
      min = Math.min(min, val)
      max = Math.max(max, val)
    }
    const mean = sum / pixelCount
    metrics.meanBrightness = mean / 255

    // Border edge analysis (check if content touches borders - indicates cropping risk)
    const borderWidth = Math.floor(Math.min(metadata.width || width, metadata.height || height) * 0.05) // 5% of smaller dimension
    const borderEdgeDensity = await analyzeBorderEdges(imageBuffer, metadata.width || width, metadata.height || height, borderWidth)
    metrics.borderEdgeDensity = borderEdgeDensity

    if (borderEdgeDensity > 0.25) {
      // Only fail for severe cropping (very high edge density at borders)
      issues.push({
        id: 'cropping-severe',
        severity: 'fail',
        message: kind === 'actor'
          ? 'Photo appears severely cropped - subject touches image edges'
          : 'Garment appears severely cropped - edges touch image borders',
        fix: kind === 'actor'
          ? 'Ensure the full person is visible with some margin around edges. Avoid cropping hands, head, or body parts.'
          : 'Ensure the garment has some margin around all edges for better cutout accuracy.',
        metric: borderEdgeDensity,
      })
    } else if (borderEdgeDensity > 0.15) {
      issues.push({
        id: 'cropping-risk',
        severity: 'warn',
        message: kind === 'actor'
          ? 'Photo may be cropped or subject touches image edges'
          : 'Garment edges may touch image borders',
        fix: kind === 'actor'
          ? 'Ensure the full person is visible with some margin around edges. Avoid cropping hands, head, or body parts.'
          : 'Ensure the garment has some margin around all edges for better cutout accuracy.',
        metric: borderEdgeDensity,
      })
    }

    // For actors: Try to detect if there's a person/face (simple heuristic)
    if (kind === 'actor') {
      // Check if image has reasonable person-like proportions
      const aspectRatio = (metadata.width || width) / (metadata.height || height)
      const hasPersonLikeProportions = aspectRatio > 0.5 && aspectRatio < 2.0

      // Check center region for face-like features (darker eyes, lighter face)
      const centerRegionBrightness = await analyzeCenterRegion(imageBuffer, metadata.width || width, metadata.height || height)
      metrics.centerRegionBrightness = centerRegionBrightness

      // Only fail if very unlikely to be a person (very strict threshold)
      if (!hasPersonLikeProportions && centerRegionBrightness < 0.15) {
        issues.push({
          id: 'no-face-detected',
          severity: 'fail',
          message: 'No face or person detected in photo',
          fix: 'Ensure the photo shows a clear view of a person facing the camera. The face should be visible and well-lit.',
          metric: centerRegionBrightness,
        })
      } else if (centerRegionBrightness < 0.2) {
        issues.push({
          id: 'face-too-small',
          severity: 'warn',
          message: 'Person may be too far away or face is too small',
          fix: 'Move closer or zoom in to ensure the person fills more of the frame. The face should be clearly visible.',
          metric: centerRegionBrightness,
        })
      }
    }

    // For garments: Check if person is detected (warn if so)
    if (kind === 'garment') {
      // Note: Simple brightness-based person detection is unreliable and prone to false positives.
      // We'll skip this check for now. In the future, this could use proper ML-based detection.
      // For now, we rely on user judgment and other quality checks.
      
      // Check background contrast (estimate foreground/background separation)
      const contrastScore = await estimateContrast(imageBuffer, metadata.width || width, metadata.height || height)
      metrics.backgroundContrast = contrastScore

      if (contrastScore < 0.2) {
        issues.push({
          id: 'background-contrast',
          severity: 'warn',
          message: 'Low contrast between garment and background',
          fix: 'Use a plain background that contrasts with the garment color. White or light backgrounds work well for dark garments, and vice versa.',
          metric: contrastScore,
        })
      }
    }

    // If server analysis fails completely, return a warning
    if (issues.length === 0 && Object.keys(metrics).length <= 2) {
      issues.push({
        id: 'server-unavailable',
        severity: 'warn',
        message: 'Server analysis unavailable; using quick checks only',
        fix: 'Photo will be saved with basic quality checks. For best results, ensure good lighting and resolution.',
      })
    }

    const result: PhotoAnalysisPartial = {
      issues,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
    }

    // Cache result
    analysisCache.set(cacheKey, { result, timestamp: Date.now() })

    // Clean old cache entries (simple cleanup)
    if (analysisCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of analysisCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          analysisCache.delete(key)
        }
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API] Error in photo analysis:', error)
    // Return a safe fallback
    return NextResponse.json({
      issues: [{
        id: 'server-unavailable',
        severity: 'warn',
        message: 'Server analysis unavailable; using quick checks only',
        fix: 'Photo will be saved with basic quality checks.',
      }],
    } as PhotoAnalysisPartial)
  }
}

// Helper: Analyze border edges for cropping detection
async function analyzeBorderEdges(buffer: Buffer, width: number, height: number, borderWidth: number): Promise<number> {
  // This is a simplified check - in a real implementation, you'd use more sophisticated edge detection
  // For now, we'll use a simple heuristic based on brightness variance at borders
  try {
    const { data } = await sharp(buffer)
      .greyscale()
      .extract({ left: 0, top: 0, width: Math.min(borderWidth, width), height })
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calculate variance in border region
    let sum = 0
    let sumSq = 0
    const pixelCount = data.length
    for (let i = 0; i < pixelCount; i++) {
      const val = data[i]
      sum += val
      sumSq += val * val
    }
    const mean = sum / pixelCount
    const variance = (sumSq / pixelCount) - (mean * mean)

    // Normalize to 0-1 range
    return Math.min(1, variance / (255 * 255))
  } catch {
    return 0
  }
}

// Helper: Analyze center region (for face/person detection)
async function analyzeCenterRegion(buffer: Buffer, width: number, height: number): Promise<number> {
  try {
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)
    const regionSize = Math.min(width, height) * 0.3

    const { data } = await sharp(buffer)
      .greyscale()
      .extract({
        left: Math.max(0, centerX - regionSize / 2),
        top: Math.max(0, centerY - regionSize / 2),
        width: Math.min(regionSize, width),
        height: Math.min(regionSize, height),
      })
      .raw()
      .toBuffer({ resolveWithObject: true })

    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i]
    }
    return (sum / data.length) / 255
  } catch {
    return 0.5
  }
}

// Helper: Estimate contrast between foreground and background
async function estimateContrast(buffer: Buffer, width: number, height: number): Promise<number> {
  try {
    // Sample center (likely foreground) vs edges (likely background)
    const centerSize = Math.min(width, height) * 0.4
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)

    const centerData = await sharp(buffer)
      .greyscale()
      .extract({
        left: Math.max(0, centerX - centerSize / 2),
        top: Math.max(0, centerY - centerSize / 2),
        width: Math.min(centerSize, width),
        height: Math.min(centerSize, height),
      })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const edgeData = await sharp(buffer)
      .greyscale()
      .extract({ left: 0, top: 0, width: Math.floor(width * 0.1), height })
      .raw()
      .toBuffer({ resolveWithObject: true })

    let centerSum = 0
    for (let i = 0; i < centerData.data.length; i++) {
      centerSum += centerData.data[i]
    }
    const centerMean = centerSum / centerData.data.length

    let edgeSum = 0
    for (let i = 0; i < edgeData.data.length; i++) {
      edgeSum += edgeData.data[i]
    }
    const edgeMean = edgeSum / edgeData.data.length

    // Contrast is the difference normalized
    const contrast = Math.abs(centerMean - edgeMean) / 255
    return contrast
  } catch {
    return 0.5
  }
}
