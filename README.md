# dsh-plugin-deepseek-chat / DeepSeek Chat 面板

A DeepSeek Harness client plugin that adds a **DeepSeek Chat** panel to the
right Sidebar. See [docs/DETAIL.md](docs/DETAIL.md) for usage and
[docs/DESIGN.md](docs/DESIGN.md) for the original design document.

一个为 DeepSeek Harness 右侧边栏新增 **DeepSeek Chat** 面板的客户端插件。
用法详见 [docs/DETAIL.md](docs/DETAIL.md)（中文），原始设计见
[docs/DESIGN.md](docs/DESIGN.md)。

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
| Embedding carrier | The Web GUI embeds pages via sandboxed iframe; `chat.deepseek.com` sends `CSP: frame-ancestors 'none'` (verified live via HTTP headers), so Web embedding is refused by the site. Desktop (Electron) uses `<webview>`, which is not subject to `frame-ancestors`. |

## Structure

The DESIGN.md sketch (`src/index.ts`, `src/DeepSeekChatPanel.tsx`) was adapted
to the format the Harness Client module loader actually consumes: a plain-JS
lazy-CJS factory (`client.js`) registered via `window.__ModuleLoader__.load`,
with React taken from the browser module table — no build step, matching the
`dsh-doc` decoration template.

```
package.json        # dsh.bundle.patch + dsh.client manifest
cordis.patch.yml    # inserts the plugin row
index.js            # Host half (no-op)
client.js           # Client half: sidebar tab type + panel body
locale/en|zh.json   # display metadata for Plugins/Settings
icon.svg            # plugin icon
docs/               # DESIGN.md, DETAIL.md
```

## Install

In the Harness Web GUI: **Plugins > Add plugin**, point it at this directory;
or from an agent with the `plugin_manager` tool, `install_bundle` with this
directory as the target.
