import { PhotoKind, PhotoAnalysisResult, PhotoAnalysisPartial, Severity } from './types'

// Penalty scores for different issue severities
const PENALTIES = {
  warn: {
    'resolution-low': -10,
    'aspect-too-narrow': -8,
    'aspect-too-wide': -8,
    'blur-moderate': -12,
    'brightness-too-dark': -10,
    'brightness-too-bright': -10,
    'brightness-clipped': -10,
    'clutter-high': -8,
    'actor-too-small': -10,
    'garment-too-small': -10,
    'server-unavailable': -5,
    'person-detected-garment': -15,
    'cropping-risk': -12,
    'background-contrast': -10,
    'face-too-small': -10,
    default: -10,
  },
  fail: {
    'resolution-too-low': -25,  // Reduced from -35
    'blur-severe': -20,         // Reduced from -30
    'no-face-detected': -30,    // Reduced from -40
    'cropping-severe': -20,      // Reduced from -25
    default: -25,                // Reduced from -30
  },
}

export function combineAnalysis(
  kind: PhotoKind,
  clientPartial: PhotoAnalysisPartial,
  serverPartial: PhotoAnalysisPartial | null
): PhotoAnalysisResult {
  const issues: PhotoAnalysisPartial['issues'] = []
  const issueMap = new Map<string, PhotoAnalysisPartial['issues'][0]>()

  // Add client issues
  for (const issue of clientPartial.issues) {
    issueMap.set(issue.id, issue)
  }

  // Merge server issues (server overrides client if severity is worse)
  if (serverPartial) {
    for (const serverIssue of serverPartial.issues) {
      const existing = issueMap.get(serverIssue.id)
      if (!existing) {
        issueMap.set(serverIssue.id, serverIssue)
      } else {
        // Server overrides if severity is worse
        const severityOrder: Severity[] = ['pass', 'warn', 'fail']
        if (severityOrder.indexOf(serverIssue.severity) > severityOrder.indexOf(existing.severity)) {
          issueMap.set(serverIssue.id, serverIssue)
        }
      }
    }
  }

  issues.push(...Array.from(issueMap.values()))

  // Calculate score (starts at 100, subtract penalties)
  let score = 100
  for (const issue of issues) {
    if (issue.severity === 'warn') {
      const penalty = PENALTIES.warn[issue.id as keyof typeof PENALTIES.warn] || PENALTIES.warn.default
      score += penalty
    } else if (issue.severity === 'fail') {
      const penalty = PENALTIES.fail[issue.id as keyof typeof PENALTIES.fail] || PENALTIES.fail.default
      score += penalty
    }
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score))

  // Determine overall status
  let status: Severity = 'pass'
  if (issues.some(i => i.severity === 'fail')) {
    status = 'fail'
  } else if (issues.some(i => i.severity === 'warn')) {
    status = 'warn'
  }

  // Combine metrics
  const clientMetrics = clientPartial.metrics || {}
  const serverMetrics = serverPartial?.metrics || {}

  return {
    kind,
    score,
    status,
    issues,
    clientMetrics: Object.keys(clientMetrics).length > 0 ? clientMetrics : undefined,
    serverMetrics: Object.keys(serverMetrics).length > 0 ? serverMetrics : undefined,
    analyzedAt: new Date().toISOString(),
    version: '1.0',
  }
}
