'use client'

import { PhotoAnalysisResult, Severity } from '@/lib/photoAnalysis/types'

interface PhotoQualityBadgeProps {
  analysis: PhotoAnalysisResult | null
  showScore?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PhotoQualityBadge({ analysis, showScore = false, size = 'md' }: PhotoQualityBadgeProps) {
  if (!analysis) {
    return null
  }

  const getStatusIcon = (status: Severity) => {
    switch (status) {
      case 'pass':
        return '✅'
      case 'warn':
        return '⚠️'
      case 'fail':
        return '❌'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status: Severity) => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'warn':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded border ${getStatusColor(analysis.status)} ${sizeClasses[size]}`}
      title={`Photo Quality: ${analysis.status.toUpperCase()} (Score: ${analysis.score}/100)`}
    >
      <span>{getStatusIcon(analysis.status)}</span>
      {showScore && (
        <span className="font-semibold">{analysis.score}</span>
      )}
    </div>
  )
}
