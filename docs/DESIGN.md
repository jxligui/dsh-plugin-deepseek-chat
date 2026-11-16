# DSH 插件：DeepSeek Chat 内嵌面板 — 设计文档


## 1. 目标
在 DeepSeek Harness（DSH）的 Web GUI 中新增一个「DeepSeek Chat」面板，
复用 DSH 已登录账号的会话态，直接加载 https://chat.deepseek.com/ 并使用
其基础聊天功能，无需二次登录。


## 2. 现状与约束

- DSH 是 Electron 应用；Web GUI 地址由运行时动态分配（本机为 http://127.0.0.1:64414）。
- 插件分 host plugin（Node 侧）与 client plugin（Web GUI 侧，经 dev:web 热更新）。
  本插件需要 DOM/webview，属于 client plugin。
- chat.deepseek.com 登录态存储：
  - Cookie：`token`（JWT，域 `.deepseek.com`）、`dsers` 等会话 cookie
  - localStorage：`userToken`、`webId` 等

  
- 关键不确定性（落地前必须核实）：
  DSH 登录账号保存的凭据是「网页版同源 token」还是「独立 API key」。
  前者可直接复用；后者无法静默注入，采用“一次登录、持久分区记住”的降级路线。




## 3. 总体方案
Client plugin 注册一个面板/工具栏按钮，点击后渲染内嵌 `<webview>`：

    <webview src="https://chat.deepseek.com/" partition="persist:dsh-deepseek-chat" allowpopups />

要点：

1. `persist:` 前缀分区 → cookie / localStorage 持久化，登录一次永久有效。
2. 若能取到与网页同源的 token（核实点 3.1），首次加载前通过
   `session.setCookie`（经 host plugin 或 preload）注入，实现免登录直开；
   否则面板显示「首次需登录一次」提示，之后由持久分区接管。
3. 不使用 `shell.openExternal` 方案（无法共享登录态），仅作为降级备选。




## 4. 目录结构

    dsh-plugin-deepseek-chat/
    ├── package.json          # manifest：engines.dsh 版本要求
    ├── README.md
    ├── docs/DESIGN.md
    └── src/
        ├── index.ts          # client plugin 入口：注册面板/槽位
        └── DeepSeekChatPanel.tsx


## 5. 实施核查清单（开发前逐项确认）

- [ ] 5.1 `skill: dsh-doc` 加载插件文档，确认 manifest 字段与面板/slot 注册 API。
- [ ] 5.2 阅读 DSH 安装目录（…\resources\app.asar\dsh\）现有插件示例，对齐结构。
- [ ] 5.3 确认 DSH 账号凭据形态（同源 token / API key），决定注入 or 引导登录。
- [ ] 5.4 开发期保持 `pnpm run dev:web` 运行（client plugin 改动才会热更新到 GUI）。
- [ ] 5.5 Electron `<webview>` 在当前版本可用（部分 Electron 25+ 需显式启用 webviewTag）。




## 6. 验收标准

- GUI 中出现「DeepSeek Chat」入口；点击打开内嵌面板。
- 若凭据同源：打开即处于登录态；否则完成一次登录后重开仍保持登录态。
- 刷新 GUI 页面、重启 DSH 后登录态不丢失（persist 分区生效）。
