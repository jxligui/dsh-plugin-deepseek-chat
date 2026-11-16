# DSH 插件：DeepSeek Chat 内嵌面板 — 设计文档

> 状态：**已实现（v1.0.0）**。本文档保留原始设计（§1–§6）作为决策记录，
> §7 起为落地后的实际设计与实测结论；两者冲突处以 §7 为准。

## 1. 目标

在 DeepSeek Harness（DSH）中新增「DeepSeek Chat」面板，直接加载
https://chat.deepseek.com/ 并使用其基础聊天功能，无需二次登录。

## 2. 现状与约束（原始假设）

- DSH 是 Electron 应用；Web GUI 地址由运行时动态分配。
- 插件分 host plugin（Node 侧）与 client plugin（GUI 侧）。本插件需要 DOM/webview，
  属于 client plugin。
- chat.deepseek.com 登录态存储：Cookie（`token` JWT 等）、localStorage（`userToken`、`webId` 等）。
- 关键不确定性：DSH 登录账号保存的凭据是「网页版同源 token」还是「独立 API key」。

## 3. 原始方案（已被 §7 取代）

原计划：client plugin 渲染 `<webview partition="persist:dsh-deepseek-chat">`，
靠 `persist:` 分区持久化登录态；无法注入凭据时退化为"登录一次、分区记住"。

## 4. 目录结构（实际）

原设计的 `src/index.ts` / `src/DeepSeekChatPanel.tsx` 调整为 Harness Client
模块加载器实际消费的格式——`window.__ModuleLoader__.load` 注册的懒加载 CJS
工厂（plain JS，React 取自浏览器模块表，无构建步骤），与 dsh-doc 装饰模板一致：

    dsh-plugin-deepseek-chat/
    ├── package.json          # dsh.bundle.patch + dsh.client manifest（inject 声明）
    ├── cordis.patch.yml      # 插件行：id deepseek-chat
    ├── index.js              # Host 半（no-op）
    ├── client.js             # Client 半：左侧入口 + 右侧标签页 + 面板体
    ├── locale/en|zh.json     # 插件管理页展示元数据（meta.title/description/detail）
    ├── icon.svg
    ├── README.md
    └── docs/                 # DESIGN.md（本文）、DETAIL.md（用户说明）

## 5. 实施核查清单 — 核查结论

- [x] 5.1 面板/槽位注册 API：对照已安装的 `dsh-client-ui-sidebar-right` /
      `-sidebar-browser` / `-sidebar-documentpreview` 与 `ui-layout` 源码核实：
      - 左侧导航入口：`ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name:'sidebar.panellist', id, order, label }, Icon))`，
        面板体注册到布局根作用域 `main` 键控槽位（同 id 为 key），需经
        `ctx.slots.inject('main', …)` 声明感知注册。
      - 右侧边栏：`ctx.sidebarRightTabs.register({ id, kind, title(): string,
        guide, keepMounted })` + body 直接键控注册
        `ctx.slots.register({ name:'sidebar.right.pane.tab', key: id }, Body)`
        （不包 inject）。**guide entry 的 `title`/`description` 必须是 thunk**
        （`() => string`），传字符串会在渲染时抛错（踩坑实测）。
- [x] 5.2 账号凭据形态：`dsh-credentials` 存 **API-key 型**凭据
      （`DEEPSEEK_API_KEY` 引用 / `<owner>/<id>` 记录），非网页同源 token
      → 静默注入路线否决。
- [x] 5.3 嵌入载体：Web GUI 用沙箱 iframe，实测 `chat.deepseek.com` 返回
      `CSP: frame-ancestors 'none'` → Web 端内嵌被站点自身禁止，任何插件无法绕过。
      桌面端 webview 不受 frame-ancestors 约束。
- [x] 5.4 桌面 webview 可用性：主窗口 `webviewTag: primary`（主窗口启用），
      但**插件自建 webview 必须持租约**：主进程 `will-attach-webview` 校验
      `window.dshDesktop.browser.acquire(workspaceKey)` 颁发的 lease/partition，
      无租约直接拦截（实测验证）。该租约桥对主窗口主框架内的客户端插件公开。

## 6. 验收标准 — 达成情况

- [x] GUI 左侧导航出现「DeepSeek Chat」入口；点击在主内容区打开内嵌面板。
- [x] 右侧边栏引导卡片提供同一面板。
- [x] 桌面端完成一次登录后，重启 DSH 登录态不丢失（见 §7 持久化方案，Windows 实测通过）。
- [x] Web 端降级：说明 + 一键外开（站点 CSP 限制，设计如此）。

## 7. 实际设计（落地后）

### 7.1 双入口

- **左侧导航**：`sidebar.panellist` 行 + `main` 键控面板（`MainPanel` 包装保证
  `min-height: calc(100vh - var(--dsh-frame-top-clearance))`）。
- **右侧边栏**：`sidebarRightTabs` 类型 + 引导卡片 + 键控 body（`keepMounted: true`，
  切换标签/会话保活）。

### 7.2 桌面端内嵌（租约 webview）

完全对齐官方 `ui-sidebar-browser` 的桌面实现
（`ElectronWebViewImpl` / `ElectronWebviewPresentation`）：

1. `const reservation = await window.dshDesktop.browser.acquire('plugin:dsh-plugin-deepseek-chat')`
   —— 桥按 workspace key 复用内存分区，cookie 在进程内跨面板开关保留。
2. 创建 `<webview name=lease partition=reservation.partition allowpopups
   src="about:blank#lease">`，追加进宿主后由主进程租约校验放行。
3. bootstrap 文档 dom-ready 后 `loadURL(CHAT_URL)`。
4. 布局采用官方 flex 链（`.root h100% → content/viewport flex:1 → webview
   flex:1 w/h 100%`），并以 `ResizeObserver` 驱动像素级尺寸同步——
   webview 内部 guest 视图不跟随 CSS 百分比尺寸，否则出现压缩/错位。

### 7.3 登录态持久化（快照/恢复）

租约分区是**内存态**（`dsh-sidebar-browser-<uuid>`，无 `persist:` 前缀，主进程
硬编码，无配置可改）——官方沙箱策略下插件无法获得跨重启的原生会话。因此：

- **快照**：webview `executeJavaScript` 定时探测站内 `localStorage.userToken`；
  登录后把整个 localStorage + `document.cookie`（非 httpOnly）写入应用自身
  localStorage（key `dsh-deepseek-chat.snapshot.v1`），每次探测刷新（跟随 token 轮换）。
- **恢复**：启动后先加载同源极小文档 `robots.txt` 注入快照，再一次性进入正式页
  （避免加载两遍完整 SPA）。
- **进程内快速路径**：登录确认过一次后置 `partitionWarmed` 标记，同进程重开面板
  直接单次加载（分区 cookie 仍热）。
- **防闪屏**：webview 上方盖不透明遮罩（主题色 `--dsw-alias-bg-base`），每 800ms
  探测，状态安定后一次性移除；8 秒兜底强制放行。
  （曾尝试 `visibility:hidden` 门控——webview 合成器会黑屏，弃用。）

### 7.4 Web 端降级

面板显示双语说明 + **Open DeepSeek Chat** 外开按钮；登录态由浏览器自身存储保持。

### 7.5 平台支持

| 平台 | 行为 |
|---|---|
| 桌面版 Windows / macOS / Linux | 租约内嵌 + 快照持久化（桥跨平台实现，Windows 实测；macOS/Linux 同路径未实测） |
| Web GUI | 外开降级（站点 CSP） |

### 7.6 已知边界

- 快照只能覆盖 JS 可读存储；若站点关键会话 cookie 为 httpOnly 且校验强依赖它，
  恢复会退化为重新登录（Windows 实测正常）。
- 桌面端下载/弹窗权限遵循 Harness Desktop webview 策略。
- 替换已安装包的 client 模块需重启 DSH 才能加载新模块代际。
