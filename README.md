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

## Install / 安装

Three ways to install. After any of them, **restart DeepSeek Harness once** so
the new client module generation loads. 安装后**请完全重启一次 DeepSeek Harness**
以加载新的客户端模块。

### Way 1 — From the GitHub address (fastest) / 方式一：GitHub 地址快速安装（推荐）

**English**

1. Open the Harness **Plugins** page (left navigation → Plugins) → **Add plugin**.
2. In the spec form, enter the repository address:

   ```text
   github:jxligui/dsh-plugin-deepseek-chat
   ```

   or equivalently `https://github.com/jxligui/dsh-plugin-deepseek-chat.git`.
   Pin a release by appending the tag, e.g.
   `github:jxligui/dsh-plugin-deepseek-chat#v0.3.0`.
3. Confirm the dialog (name/version check screen → install → done). The Host
   verifies the repository is reachable (`git ls-remote`) before pnpm runs.
4. Restart DeepSeek Harness. The **DeepSeek Chat** entry appears in the left
   navigation and the right Sidebar guide.

With an agent that has the `plugin_manager` tool, the same install is one call:

```
plugin_manager install_bundle target="github:jxligui/dsh-plugin-deepseek-chat#v0.3.0"
```

**中文**

1. 打开 Harness **插件（Plugins）页面** → **添加插件（Add plugin）**。
2. 在规格（spec）输入框填入仓库地址：

   ```text
   github:jxligui/dsh-plugin-deepseek-chat
   ```

   也可以填 `https://github.com/jxligui/dsh-plugin-deepseek-chat.git`；要锁定
   版本可在后面加标签，例如 `github:jxligui/dsh-plugin-deepseek-chat#v0.3.0`。
3. 确认安装（名称/版本检查 → 安装 → 完成）。安装器会先用 `git ls-remote`
   检查仓库可达性，再由 pnpm 拉取，无需手动 clone。
4. **重启 DeepSeek Harness**。左侧导航出现 **DeepSeek Chat** 入口，右侧边栏
   引导页出现同名卡片。

如果手边有带 `plugin_manager` 工具的 Agent，一次调用即可完成安装：

```
plugin_manager install_bundle target="github:jxligui/dsh-plugin-deepseek-chat#v0.3.0"
```

### Way 2 — From a local directory / 方式二：本地目录安装（开发调试）

**English** — In the Plugins page → **Add plugin**, switch the spec form to a
local path and point it at the checkout directory (e.g.
`D:\WorkSpace\DeepSeek\dsh-plugin-deepseek-chat`); the profile links the
directory, so code edits take effect at the next entry restart (a full app
restart for client modules). Or: `plugin_manager install_bundle` with the
directory as the target.

**中文** — 插件页 → **添加插件**，把规格切换为本地路径，指向本仓库的检出目录
（例如 `D:\WorkSpace\DeepSeek\dsh-plugin-deepseek-chat`）。profile 会以 link
方式链接该目录，适合开发调试：改完代码重启应用即可生效（client 模块需重启加载
新代际）。也可用 Agent 调 `plugin_manager install_bundle` 并以目录为 target。

### Way 3 — From a published npm package / 方式三：npm 包安装

**English / 中文** — If (or once) the package is published to an npm registry,
install the spec `dsh-plugin-deepseek-chat` (optionally `@<version>`) through
the Plugins page or `plugin_manager install_bundle`; published versions can
also be updated later with the bundle page's **Update** control.

### After installing / 安装后

**English**

- Restart the app once, then look for the **DeepSeek Chat** entry (left
  navigation) and the guide card (right Sidebar).
- Visibility settings: **Settings → DeepSeek Chat**, or Plugins page →
  DeepSeek Chat card → **Configure** (see [Settings](#settings--设置)).
- Updates: a GitHub-installed bundle shows an **Update** control on its
  Plugins-page card when a newer commit/tag is available per the Host's git
  update flow; or reinstall the newer tag with Way 1.

**中文**

- 重启一次应用后，左侧导航出现 **DeepSeek Chat** 入口，右侧边栏引导页出现卡片。
- 显示设置在 **设置 → DeepSeek Chat** 分区，或插件页 DeepSeek Chat 卡片 →
  **配置**（见[设置](#settings--设置)）。
- 更新：GitHub 安装的组合包在有新提交/标签时，插件页卡片上会出现**更新**
  控件；也可以用方式一重新安装更新的标签（如 `#v0.3.1`）。

### Uninstall / 卸载

**English / 中文** — Plugins page → DeepSeek Chat card → **Uninstall**（卸载），
then restart the app. 卸载后重启一次应用即可。The visibility setting is stored
in the profile's `cordis.patch.yml` under the `deepseek-chat` row and is
removed with the bundle. 显示设置随组合包一并从 profile 移除。
