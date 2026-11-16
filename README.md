# dsh-plugin-deepseek-chat

A DeepSeek Harness client plugin that adds a **DeepSeek Chat** panel to the
right Sidebar. See [docs/DETAIL.md](docs/DETAIL.md) for usage and
[docs/DESIGN.md](docs/DESIGN.md) for the original design document.

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
