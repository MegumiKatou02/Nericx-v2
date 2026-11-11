export interface AppMetricLike {
  pid: number
  type: string
  memory?: {
    workingSetSize?: number
    privateBytes?: number
  }
}

export interface MetricsSummary {
  totalMB: number
  processes: Array<{ pid: number; type: string; privateMB: number }>
}

/**
 * Summarise Electron's per-process memory table. Electron reports kilobytes,
 * so every figure is rounded to whole megabytes before it is summed, which
 * keeps `totalMB` equal to the sum of the listed rows.
 */
export function summarizeAppMetrics(metrics: AppMetricLike[]): MetricsSummary {
  const processes = metrics
    .map(metric => ({
      pid: metric.pid,
      type: metric.type,
      privateMB: Math.round((metric.memory?.privateBytes ?? 0) / 1024)
    }))
    .sort((a, b) => b.privateMB - a.privateMB)

  const totalMB = processes.reduce((total, entry) => total + entry.privateMB, 0)

  return { totalMB, processes }
}
