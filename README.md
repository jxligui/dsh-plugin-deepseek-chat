# dsh-plugin-deepseek-chat / DeepSeek Chat 面板

A DeepSeek Harness client plugin that adds a **DeepSeek Chat** entry to the
left navigation and a right-Sidebar panel. See [docs/DETAIL.md](docs/DETAIL.md)
for usage and [docs/DESIGN.md](docs/DESIGN.md) for the original design document.

一个为 DeepSeek Harness 左侧导航新增 **DeepSeek Chat** 入口、并在右侧边栏
提供面板的客户端插件。用法详见 [docs/DETAIL.md](docs/DETAIL.md)（中文），
原始设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## Supported platforms / 支持的平台

| Platform | Behavior |
|---|---|
| **Desktop Windows / macOS / Linux** (Electron) | Full experience: the panel embeds chat.deepseek.com via the official Browser lease bridge; sign in once and the session is snapshotted and restored across restarts |
| **Web GUI** (any browser) | Degraded mode: the site's CSP forbids iframes, so the panel offers a notice and a one-click external open; login persistence comes from the browser's own storage |

On macOS the same lease bridge and webview policy apply (platform differences
in the Harness desktop shell are window-chrome only); if the bridge were
unavailable, the panel degrades gracefully to the right-Sidebar Browser or the
system browser. 已在 Windows 桌面版实测；macOS/Linux 桌面版走同一实现路径。

## Usage

1. **Left sidebar**: click the **DeepSeek Chat** row in the left navigation
   (a blue chat-bubble icon when collapsed); the panel opens in the main
   content area, like the Plugins page.
2. **Right sidebar** (optional): open the right Sidebar and pick the
   **DeepSeek Chat** card in the guide.
3. Desktop: use the chat inline; sign in once. Web: use the open button.

## Settings / 设置

The sidebar-visibility settings live **directly in the Settings window** as its
own **DeepSeek Chat** section (beside 通用设置 / 模型 / 内置插件). The same panel
is also available on the Plugins page (DeepSeek Chat card → Configure).

Choose where the panel shows: **left sidebar**, **right sidebar**, or both
(both on by default). Saves apply live without a restart, and **at least one
entry always stays visible** — the form disables the last enabled switch, and
a "both off" config falls back to the left sidebar.
在 **设置 → DeepSeek Chat** 分区（或插件页 DeepSeek Chat 卡片 → 配置）里可自定义
左/右侧栏显示，保存即时生效，且至少保留一处显示。

## 💰 Free basic service / 免费基础服务

The panel loads the chat.deepseek.com web app, whose basic chat service is
**free to use** — no API quota, no API billing. Use it for everyday Q&A and
drafting, and save your paid API balance for programmatic work inside the
Harness.

面板直接加载 chat.deepseek.com 网页版，网页版对话属于 DeepSeek 的**免费基础
服务**，不消耗 API 额度。日常问答、写草稿走网页版，把付费 API 余额留给
Harness 中需要程序化调用的任务，节约成本。

## Verified design decisions

| Design question | Finding |
|---|---|
| Panel registration API | `ctx.sidebarRightTabs.register({ id, kind, title, guide, keepMounted })` for the tab type, `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id }, Body)` for the body, opened via the guide card (`ctx.sidebarRight.openTab(kind)`). Verified against the shipped `@deepseek-ai/dsh-client-ui-sidebar-right` / `-sidebar-browser` / `-sidebar-documentpreview` packages. |
| Account credential form | API-key shaped: the `@deepseek-ai/dsh-credentials` seam stores `DEEPSEEK_API_KEY`-style references and `<owner>/<id>` records — not the chat site's same-origin web token. Silent token injection (DESIGN.md §3.1) is not possible; the "log in once, persistent partition" route is used. |
| Embedding carrier | The Web GUI embeds pages via sandboxed iframe; `chat.deepseek.com` sends `CSP: frame-ancestors 'none'` (verified live via HTTP headers), so Web embedding is refused by the site. Desktop (Electron) uses a lease-backed `<webview>` (`window.dshDesktop.browser.acquire`), with the site session snapshotted to app-local storage and restored on each launch, since lease partitions are in-memory by policy. |

## Structure

The DESIGN.md sketch (`src/index.ts`, `src/DeepSeekChatPanel.tsx`) was adapted
to the format the Harness Client module loader actually consumes: a plain-JS
lazy-CJS factory (`client.js`) registered via `window.__ModuleLoader__.load`,
with React taken from the browser module table — no build step, matching the
`dsh-doc` decoration template.

```
package.json        # dsh.bundle.patch + dsh.client manifest + schemastery dep
cordis.patch.yml    # inserts the plugin row
index.js            # Host half: volatile Config (showInLeftSidebar/showInRightSidebar)
client.js           # Client half: config-driven sidebar entries + Plugins row settings page
locale/en|zh.json   # display metadata for Plugins/Settings
icon.svg            # plugin icon
docs/               # DESIGN.md, DETAIL.md
```

## Install

In the Harness Web GUI: **Plugins > Add plugin**, point it at this directory;
or from an agent with the `plugin_manager` tool, `install_bundle` with this
directory as the target.
