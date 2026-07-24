# Shencup · 部署上线指南

面向国内、免备案先用平台子域名上线，自定义域名后补 ICP 备案。
整个流程分两块：**前端静态托管**（必须）+ **榜单后端**（可选，缺它也能上线）。

> 主流程（筛选 / 淘汰 / 冠军 / 结果图导出）**不依赖后端**，可先纯静态上线，榜单随后补。

---

## 一、本地开发

```bash
npm install
npm run dev          # http://localhost:5173
```

## 二、数据

1. 打开 `data/曲库模板.csv`（Excel：**另存为 → CSV UTF-8**，避免乱码）。
2. 填入周深全曲库：`歌曲名` 必填，`专辑/年份/赛道/词/曲/编/制/热度` 能填则填、不能留空。
3. 另存为 `data/catalog.csv`，然后：

```bash
npm run ingest       # 生成 src/data/catalog.json
```

> `热度` 1–100 用于对阵种子分档（避免强歌首轮相撞）；留空则自动随机赋值。

---

## 三、前端部署（腾讯云开发 CloudBase，免备案子域名）

1. 登录腾讯云 → 控制台搜索 **「云开发 CloudBase」** → **新建环境**（选「按量计费」，新用户有免费额度）。
   - 记下 **环境 ID（envId）**。
2. 进入环境 → **静态网站托管** → 上传 `dist/`（先在本地 `npm run build` 生成）。
   - 或用 CLI：`npm i -g @cloudbase/cli` → `tcb login` → `tcb hosting deploy ./dist -e <envId>`
3. 上传后会得到一个 `*.tcloudbaseapp.com`（或类似）的**默认域名**，**立即可访问、无需备案**。这就是先上线的地址。
4. （以后）**自定义域名**：在静态托管里绑定自己的域名，并按提示完成 **ICP 备案**（约 1–2 周）。

---

## 四、榜单后端（可选，让全局榜单生效）

1. **开匿名登录**：环境 → 「登录授权」→ 启用「匿名登录」。
2. **建集合**：环境 → 「数据库」→ 新建集合 `song_rank`（权限：所有用户可读）。
   再建 `shencup_submissions`（用于去重，权限仅创建者可写）。
3. **部署云函数**：把 `functions/rank/` 部署上去。
   - CLI：`tcb fn deploy rank -e <envId>`（函数依赖会自动安装）。
   - 或控制台「云函数」→ 新建 `rank` → 把 `functions/rank/index.js` 粘进去，运行时选 Node.js 16/18。
   - 在函数配置里把环境变量 `CB_ENVID` 设为你的环境 ID。
4. **开启 HTTP 访问**：环境 → 「访问服务 / HTTP 访问」→ 添加路径映射，例如 `POST /rank` → 云函数 `rank`。
   - 得到一个形如 `https://<envId>.service.tcloudbase.com/rank` 的地址。
5. **填进前端**：项目根目录建 `.env`（参考 `.env.example`）：
   ```
   VITE_CB_URL=https://<envId>.service.tcloudbase.com/rank
   ```
6. 重新 `npm run build` 并再次上传 `dist/`。

完成后，冠军页可「上报本局结果」，`/rank` 页汇聚大家的投票。每个浏览器限上报 5 次，且同一局（runId）不可重复（轻量防刷）。

---

## 五、构建与产物

```bash
npm run build        # 输出到 dist/
```

产物为纯静态文件（HTML/JS/CSS），可托管在任意 CDN/对象存储。
