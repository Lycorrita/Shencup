// Shencup · 全局榜单云函数（腾讯云开发 CloudBase）
// 动作：get（取四榜数据）/ submit（上报一局结果）
// 四个计数字段：champions / runnerUps / semifinals / rescues
// 兼容 SDK callFunction 与 HTTP 访问服务 POST。

const tcb = require('@cloudbase/node-sdk')

const ENV = process.env.CB_ENVID || ''
const app = tcb.init(ENV ? { env: ENV } : {})
const db = app.database()
const _ = db.command

const COL = 'song_rank'
const COL_SUB = 'shencup_submissions'

exports.main = async (event) => {
  let p = event || {}
  if (typeof p.body === 'string') {
    try {
      p = JSON.parse(p.body)
    } catch {
      p = {}
    }
  }
  const action = p.action

  try {
    if (action === 'get') {
      const r = await db
        .collection(COL)
        .orderBy('champions', 'desc')
        .limit(300)
        .get()
      return {
        ok: true,
        data: (r.data || []).map((d) => ({
          id: d._id,
          title: d.title || '',
          album: d.album || '',
          year: d.year || null,
          champions: d.champions || 0,
          runnerUps: d.runnerUps || 0,
          semifinals: d.semifinals || 0,
          rescues: d.rescues || 0,
        })),
      }
    }

    if (action === 'submit') {
      const token = String(p.token || '')
      const s = p.summary || {}
      if (!s.championId) return { ok: false, reason: '缺少冠军' }

      // 每个浏览器仅允许上报一次
      if (token) {
        const exist = await db.collection(COL_SUB).doc(token).get()
        if (exist && exist.data && exist.data.length) {
          return { ok: false, reason: '已上报过' }
        }
      }

      const metaMap = new Map((p.meta || []).map((m) => [m.id, m]))
      const ensure = async (id) => {
        if (!id) return
        const m = metaMap.get(id) || {}
        const ex = await db.collection(COL).doc(id).get()
        if (ex && ex.data && ex.data.length) return
        await db.collection(COL).doc(id).set({
          title: m.title || '',
          album: m.album || '',
          year: m.year || null,
          champions: 0,
          runnerUps: 0,
          semifinals: 0,
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

      for (const id of s.semifinalIds || []) {
        await ensure(id)
        await inc(id, 'semifinals', 1)
      }

      for (const [id, cnt] of Object.entries(s.rescues || {})) {
        const n = Number(cnt) || 0
        if (n > 0) {
          await ensure(id)
          await inc(id, 'rescues', n)
        }
      }

      if (token) {
        await db.collection(COL_SUB).doc(token).set({ at: Date.now() })
      }
      return { ok: true }
    }

    return { ok: false, reason: '未知动作' }
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  }
}
