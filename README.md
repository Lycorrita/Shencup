# Shencup · 周深全曲库对决

## 流程

```
全曲库 → 第一轮·筛选（砍掉一半，不计数据）
      → 淘汰赛（1v1，按轮次记入梯队）
      → 冠军页（冠军 / 亚军 / 四强 / 八强 …）
      → 结果图导出（Canvas）→ 可选上报全局榜单
```

- 无需注册，点击即玩；进度自动存于本机（localStorage），可断点续赛。
- 第一轮淘汰的曲目不再计入后续数据。

## 技术栈

- **前端**：Vue 3 + Vite + TypeScript + Pinia + Vue Router
- **引擎**：纯函数（`src/engine/tournament.ts`），种子分档 / 轮空 / 梯次汇总；`node scripts/selftest.ts` 自检
- **数据**：Excel/CSV → `npm run ingest` → `src/data/catalog.json`（无封面、无试听）
- **后端**（可选）：腾讯云开发 CloudBase 云函数 `rank`，全局榜单聚合

## 目录

```
src/
  engine/tournament.ts   赛事引擎
  stores/tournament.ts   状态机 + 续赛持久化
  views/                 首页 / 筛选 / 淘汰 / 冠军 / 榜单
  lib/                   格式化 / 结果图导出 / 榜单接口
  styles/                墨金设计令牌 + 全局样式
functions/rank/          CloudBase 云函数
scripts/                 CSV 摄取 + 引擎自检
data/                    曲库模板 / 你的 catalog.csv
```

## 开发

```bash
npm install
npm run dev
npm run ingest    # CSV → catalog.json
node scripts/selftest.ts   # 引擎自检
npm run build     # 产物 dist/
```
非官方粉丝向作品。