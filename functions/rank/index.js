// Shencup · 全局榜单云函数（腾讯云开发 CloudBase，含 Gen2 HTTP 网关适配）
// 动作：get（取五榜数据）/ submit（上报一局结果）
// 计数字段：champions / runnerUps / topTens（十强）/ rescues（捞回=复活+换位）
// 皇族榜由前端依 topTens>0 且 rescues 升序派生，无需单独字段。
// 自适应：HTTP 网关（API 网关风格 event，带 CORS）与 SDK callFunction 均兼容。

const tcb = require('@cloudbase/node-sdk')

const ENV = process.env.CB_ENVID || ''
const app = tcb.init(ENV ? { env: ENV } : {})
const db = app.database()
const _ = db.command

const COL = 'song_rank'
const COL_SUB = 'shencup_submissions'
const MAX_SUBMITS = 5

/** 集合/表不存在的错误（全新环境首次访问） */
const isNotExist = (e) => /not exist|RESOURCE_NOT_FOUND|DATABASE_COLLECTION_NOT_EXIST/i.test(String((e && e.message) || e))

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'content-type',
  'Content-Type': 'application/json; charset=utf-8',
}

function httpResp(body, status = 200) {
  return {
    statusCode: status,
    headers: CORS_HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

async function handle(p) {
  const action = p.action

  if (action === 'get') {
    let r
    try {
      r = await db
        .collection(COL)
        .orderBy('champions', 'desc')
        .limit(300)
        .get()
    } catch (e) {
      // 集合尚未创建（无人上报过）→ 返回空榜
      if (isNotExist(e)) return { ok: true, data: [] }
      return { ok: false, reason: String((e && e.message) || e) }
    }
    return {
      ok: true,
      data: (r.data || []).map((d) => ({
        id: d._id,
        title: d.title || '',
        album: d.album || '',
        year: d.year || null,
        champions: d.champions || 0,
        runnerUps: d.runnerUps || 0,
        topTens: d.topTens || d.semifinals || 0,
        rescues: d.rescues || 0,
      })),
    }
  }

  if (action === 'submit') {
    const token = String(p.token || '')
    const s = p.summary || {}
    if (!s.championId) return { ok: false, reason: '缺少冠军' }
    const runId = s.runId != null ? String(s.runId) : ''

    // 每浏览器限 MAX_SUBMITS 次、且同一局(runId)不可重复上报
    let count = 0
    let runs = []
    if (token) {
      let rec = null
      try {
        const ex = await db.collection(COL_SUB).doc(token).get()
        rec = (ex && ex.data && ex.data[0]) || null
      } catch (e) {
        if (!isNotExist(e)) return { ok: false, reason: String((e && e.message) || e) }
      }
      count = (rec && rec.count) || 0
      runs = (rec && rec.runs) || []
      if (runId && runs.includes(runId)) {
        return { ok: false, reason: '本局已上报', count, limit: MAX_SUBMITS }
      }
      if (count >= MAX_SUBMITS) {
        return { ok: false, reason: `每浏览器限上报 ${MAX_SUBMITS} 次`, count, limit: MAX_SUBMITS }
      }
    }

    const metaMap = new Map((p.meta || []).map((m) => [m.id, m]))
    const ensure = async (id) => {
      if (!id) return
      const m = metaMap.get(id) || {}
      let exists = false
      try {
        const ex = await db.collection(COL).doc(id).get()
        exists = !!(ex && ex.data && ex.data.length)
      } catch (e) {
        if (!isNotExist(e)) throw e
      }
      if (exists) return
      await db.collection(COL).doc(id).set({
        title: m.title || '',
        album: m.album || '',
        year: m.year || null,
        champions: 0,
        runnerUps: 0,
        topTens: 0,
        rescues: 0,
      })
    }
    const inc = async (id, field, by) => {
      if (!id || !by) return
      await db.collection(COL).doc(id).update({ [field]: _.inc(by) })
    }

    await ensure(s.championId)
    await inc(s.championId, 'champions', 1)

    if (s.runnerUpId) {
      await ensure(s.runnerUpId)
      await inc(s.runnerUpId, 'runnerUps', 1)
    }

    for (const id of s.top10Ids || []) {
      await ensure(id)
      await inc(id, 'topTens', 1)
    }

    for (const [id, cnt] of Object.entries(s.rescues || {})) {
      const n = Number(cnt) || 0
      if (n > 0) {
        await ensure(id)
        await inc(id, 'rescues', n)
      }
    }

    if (token) {
      if (runId) runs.push(runId)
      await db.collection(COL_SUB).doc(token).set({ at: Date.now(), count: count + 1, runs })
      return { ok: true, count: count + 1, limit: MAX_SUBMITS }
    }
    return { ok: true, count, limit: MAX_SUBMITS }
  }

  return { ok: false, reason: '未知动作' }
}

exports.main = async (event) => {
  // 判断是否为 HTTP 网关（API 网关风格 event）
  const isHttp = !!(event && (event.httpMethod || event.requestContext || event.headers))
  // CORS 预检
  const method =
    event && event.httpMethod
      ? event.httpMethod
      : event && event.requestContext && event.requestContext.http && event.requestContext.http.method
  if (isHttp && String(method || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  // 解析请求体
  let p = event
  if (event && typeof event.body === 'string') {
    try {
      p = JSON.parse(event.body)
    } catch {
      p = {}
    }
  }
  p = p || {}

  try {
    const result = await handle(p)
    return isHttp ? httpResp(result) : result
  } catch (e) {
    const result = { ok: false, reason: String((e && e.message) || e) }
    return isHttp ? httpResp(result, 500) : result
  }
}
