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
  semifinals: number
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

export async function submitResult(payload: SubmitPayload): Promise<{ ok: boolean; reason?: string }> {
  if (!CB_URL) return { ok: false, reason: '后端尚未接入' }
  try {
    const j = await call({ action: 'submit', token: token(), ...payload })
    return { ok: !!j?.ok, reason: j?.reason }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}
