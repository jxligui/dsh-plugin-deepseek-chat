# DeepSeek Chat panel

Adds a **DeepSeek Chat** tab type to the DeepSeek Harness right Sidebar, with a
guide entry card to open it.

## Behavior

- **Desktop (Electron):** the tab embeds `https://chat.deepseek.com/` in an
  Electron `<webview>` backed by the persistent partition
  `persist:dsh-deepseek-chat`. Cookies and `localStorage` survive page reloads
  and application restarts, so signing in once keeps you logged in.
- **Web GUI:** `chat.deepseek.com` answers
  `Content-Security-Policy: frame-ancestors 'none'`, so the site itself refuses
  iframe embedding and no plugin can bypass that. The tab then shows a notice
  and an **Open DeepSeek Chat** button that opens the chat in a normal browser
  tab, where the site's own login storage keeps you signed in across visits.

## Usage

1. Open the right Sidebar (the header's corner button).
2. Pick the **DeepSeek Chat** card in the guide (or via **More tools**).
3. Desktop: use the chat inline; sign in once. Web: use the open button.

## Notes

- Why not credential injection? The DeepSeek Harness account seam stores
  API-key-shaped credentials (`DEEPSEEK_API_KEY` references and
  `<owner>/<id>` records), not the chat site's same-origin web token, so there
  is nothing to inject; the persistent-partition route is the supported path.
- The tab declares `keepMounted`, so the chat stays alive while you switch
  tabs or sessions.

## Limitations

- Web embedding is impossible by the site's own CSP; the panel degrades to an
  external-open action there by design.
- On Desktop, guest permissions (downloads, native popups) follow the
  Harness Desktop webview policy; approved popups open Sidebar tabs.
