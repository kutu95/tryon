export type PhotoKind = 'actor' | 'garment'
export type Severity = 'pass' | 'warn' | 'fail'

export interface PhotoIssue {
  id: string
  severity: Severity
  message: string
  fix: string
  metric?: number
}

export interface PhotoAnalysisResult {
  kind: PhotoKind
  score: number        // 0–100
  status: Severity     // pass/warn/fail
  issues: PhotoIssue[]
  clientMetrics?: Record<string, number>
  serverMetrics?: Record<string, number>
  analyzedAt: string   // ISO
  version: string      // e.g. "1.0"
}

export interface PhotoAnalysisPartial {
  issues: PhotoIssue[]
  metrics?: Record<string, number>
}
