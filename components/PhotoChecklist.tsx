'use client'

import { useState } from 'react'
import { PhotoAnalysisResult, Severity, PhotoKind } from '@/lib/photoAnalysis/types'

interface PhotoChecklistProps {
  kind: PhotoKind
  analysis: PhotoAnalysisResult | null
  isLoading: boolean
  onRetake?: () => void
  onSaveAnyway?: () => void
}

export function PhotoChecklist({
  kind,
  analysis,
  isLoading,
  onRetake,
  onSaveAnyway,
}: PhotoChecklistProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())

  const toggleIssue = (issueId: string) => {
    const newExpanded = new Set(expandedIssues)
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId)
    } else {
      newExpanded.add(issueId)
    }
    setExpandedIssues(newExpanded)
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
        return 'bg-green-50 border-green-200 text-green-800'
      case 'warn':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'fail':
        return 'bg-red-50 border-red-200 text-red-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getIssueIcon = (severity: Severity) => {
    switch (severity) {
      case 'pass':
        return '✓'
      case 'warn':
        return '⚠'
      case 'fail':
        return '✗'
      default:
        return '•'
    }
  }

  const getIssueColor = (severity: Severity) => {
    switch (severity) {
      case 'pass':
        return 'text-green-600'
      case 'warn':
        return 'text-yellow-600'
      case 'fail':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          <span className="text-sm text-gray-600">Analyzing photo quality...</span>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(analysis.status)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon(analysis.status)}</span>
          <div>
            <h3 className="font-semibold text-lg">Photo Quality</h3>
            <p className="text-sm opacity-75">
              Status: <span className="font-medium">{analysis.status.toUpperCase()}</span>
              {' • '}
              Score: <span className="font-medium">{analysis.score}/100</span>
            </p>
          </div>
        </div>
      </div>

      {/* Issues List */}
      {analysis.issues.length > 0 ? (
        <div className="space-y-2 mb-4">
          {analysis.issues.map((issue) => (
            <div
              key={issue.id}
              className="bg-white rounded border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleIssue(issue.id)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${getIssueColor(issue.severity)}`}>
                    {getIssueIcon(issue.severity)}
                  </span>
                  <span className="text-sm font-medium">{issue.message}</span>
                </div>
                <svg
                  className={`w-4 h-4 transform transition-transform ${
                    expandedIssues.has(issue.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedIssues.has(issue.id) && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50">
                  <div className="text-sm space-y-2">
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Why this matters:</p>
                      <p className="text-gray-600">{issue.message}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">How to fix:</p>
                      <p className="text-gray-600">{issue.fix}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded border border-green-200 p-3 mb-4">
          <p className="text-sm text-green-800">
            ✓ All quality checks passed! This photo looks good for try-on.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        {onRetake && (
          <button
            onClick={onRetake}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
          >
            Retake Photo
          </button>
        )}
        {onSaveAnyway && (
          <button
            onClick={onSaveAnyway}
            className={`px-3 py-1.5 text-sm rounded-md ${
              analysis.status === 'fail'
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : analysis.status === 'warn'
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {analysis.status === 'fail' 
              ? 'Save Anyway (Not Recommended)' 
              : analysis.status === 'warn'
              ? 'Save Photo (Has Warnings)'
              : 'Save Photo'}
          </button>
        )}
      </div>
      {analysis.status === 'fail' && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
          <p className="font-medium">⚠️ Warning:</p>
          <p>This photo has quality issues that may affect try-on results. You can still save it, but results may be less accurate.</p>
        </div>
      )}
    </div>
  )
}
