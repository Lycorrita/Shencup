// Shencup · 全局榜单接口（前端）
// 通过 云函数 HTTP 访问地址 调用 functions/rank。
// 未配置地址时优雅降级，主流程不受影响。

import type { RunSummary } from '@/types'

const CB_URL = (import.meta.env.VITE_CB_URL as string | undefined) || ''
export const BACKEND_READY = !!CB_URL

export interface RankEntry {
  id: string
  title: string
  album: string
  year: number | null
  champions: number
  runnerUps: number
  topTens: number
  rescues: number
}

export interface SubmitPayload {
  artist: string
  summary: RunSummary
  meta: { id: string; title: string; album: string; year: number | null }[]
}

async function call(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(CB_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function fetchRank(): Promise<RankEntry[]> {
  if (!CB_URL) return []
  try {
    const j = await call({ action: 'get' })
    return (j && j.data) || []
  } catch {
    return []
  }
}

const TOKEN_KEY = 'shencup:token'
const SUBMITTED_KEY = 'shencup:submitted'
const SUBMIT_COUNT_KEY = 'shencup:submit-count'
const REPORTED_RUNS_KEY = 'shencup:reported-runs'

/** 每浏览器最多上报次数 */
export const MAX_SUBMITS = 5

function token(): string {
  let tk = ''
  try {
    tk = localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    /* ignore */
  }
  if (!tk) {
    tk = 't-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    try {
      localStorage.setItem(TOKEN_KEY, tk)
    } catch {
      /* ignore */
    }
  }
  return tk
}

/** 本机是否已上报过（用于榜单页毛玻璃解锁） */
export function hasSubmitted(): boolean {
  try {
    return localStorage.getItem(SUBMITTED_KEY) === '1'
  } catch {
    return false
  }
}
export function markSubmitted() {
  try {
    localStorage.setItem(SUBMITTED_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** 本机已上报次数（0..MAX） */
export function getSubmitCount(): number {
  try {
    return Math.min(MAX_SUBMITS, parseInt(localStorage.getItem(SUBMIT_COUNT_KEY) || '0', 10) || 0)
  } catch {
    return 0
  }
}
function setSubmitCount(n: number) {
  try {
    localStorage.setItem(SUBMIT_COUNT_KEY, String(n))
  } catch {
    /* ignore */
  }
}

/** 本机已上报过的 runId 集合（避免同一局重复上报） */
function readReportedRuns(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(REPORTED_RUNS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
export function isRunReported(runId: number | string): boolean {
  return readReportedRuns().has(String(runId))
}
function markRunReported(runId: number | string) {
  const s = readReportedRuns()
  s.add(String(runId))
  try {
    localStorage.setItem(REPORTED_RUNS_KEY, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

export interface SubmitResult {
  ok: boolean
  reason?: string
  /** 后端返回的本机累计上报次数 */
  count?: number
  limit?: number
}

export async function submitResult(payload: SubmitPayload): Promise<SubmitResult> {
  if (!CB_URL) return { ok: false, reason: '后端尚未接入' }
  try {
    const j = await call({ action: 'submit', token: token(), ...payload })
    if (j?.ok) {
      markSubmitted()
      if (typeof j.count === 'number') setSubmitCount(j.count)
      if (payload.summary?.runId != null) markRunReported(payload.summary.runId)
    } else if (typeof j?.count === 'number') {
      // 被拒但后端回传了当前次数（如已达上限），同步本地
      setSubmitCount(j.count)
    }
    return { ok: !!j?.ok, reason: j?.reason, count: j?.count, limit: j?.limit }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}
