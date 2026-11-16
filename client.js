/**
 * Client half of the DeepSeek Chat plugin.
 *
 * Left sidebar: a global panel entry (`sidebar.panellist` row + `main` keyed slot).
 * Right sidebar: a tab type with a guide entry card.
 *
 * Desktop (Electron) embedding follows the shipped sidebar-browser mechanics:
 * acquire a guest lease via `window.dshDesktop.browser.acquire(workspaceKey)`
 * (the lease API is open to client-plugin code running in the primary window's
 * main frame), attach a <webview> named after the lease with the granted
 * partition, bootstrap via `about:blank#<lease>`, then loadURL. The granted
 * partition is in-memory, so the panel snapshots the chat site's login state
 * (localStorage + readable cookies) into the app's own localStorage after
 * sign-in and restores it before the first load of each launch — that is the
 * only restart-surviving persistence route the sandbox policy allows.
 *
 * Web GUI: chat.deepseek.com answers `CSP: frame-ancestors 'none'`, so the
 * panel explains this and offers an external-browser fallback.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-deepseek-chat',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const CHAT_URL = 'https://chat.deepseek.com/';
    const CHAT_ORIGIN_DOC = 'https://chat.deepseek.com/robots.txt';
    const CHAT_HOST = 'chat.deepseek.com';
    const TAB_ID = 'dsh-plugin-deepseek-chat';
    const TAB_KIND = 'deepseek-chat';
    const WORKSPACE_KEY = 'plugin:dsh-plugin-deepseek-chat';
    const SNAPSHOT_KEY = 'dsh-deepseek-chat.snapshot.v1';

    const isElectron = () =>
      typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent || '');

    function readSnapshot() {
      try {
        const raw = window.localStorage.getItem(SNAPSHOT_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function writeSnapshot(snapshot) {
      try {
        window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
        return true;
      } catch (e) {
        return false;
      }
    }

    function clearSnapshot() {
      try {
        window.localStorage.removeItem(SNAPSHOT_KEY);
      } catch (e) { /* ignore */ }
    }

    const PROBE_JS =
      '(() => { try { const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }' +
      ' return JSON.stringify({ ls, cookie: document.cookie, href: location.href }); } catch (e) { return JSON.stringify({ error: String(e) }); } })()';

    function restoreJs(snapshot) {
      const payload = JSON.stringify(snapshot);
      return (
        '(() => { try { const d = ' + payload + ';' +
        ' const ls = d.ls || {}; Object.keys(ls).forEach(k => { try { localStorage.setItem(k, ls[k]); } catch (e) {} });' +
        ' const cookies = (d.cookie || "").split(/;\\s*/).filter(Boolean);' +
        ' cookies.forEach(c => { try { document.cookie = c; } catch (e) {} });' +
        ' return "ok"; } catch (e) { return String(e); } })()'
      );
    }

    const buttonStyle = {
      padding: '8px 16px',
      borderRadius: 10,
      border: '1px solid var(--dsw-border, rgba(0,0,0,0.15))',
      background: 'var(--dsw-primary, #4d6bfe)',
      color: '#fff',
      cursor: 'pointer',
      fontSize: 13,
    };

    let pluginCtx = null;
    // True once a signed-in probe has succeeded in this process: the lease
    // partition is reused per workspace key, so its cookies stay warm and a
    // reopen needs a single plain load without the snapshot restore detour.
    let partitionWarmed = false;

    function openExternal() {
      window.open(CHAT_URL, '_blank', 'noopener');
    }

    function openSidebarBrowser() {
      try {
        if (pluginCtx && pluginCtx.sidebarRight) {
          pluginCtx.sidebarRight.openTab('browser', { params: { url: CHAT_URL } });
          return true;
        }
      } catch (e) { /* fall through */ }
      return false;
    }

    /** Desktop: lease-backed webview with login-state snapshot/restore. */
    function ElectronEmbed() {
      const phaseState = React.useState('starting'); // starting|loading|login|ready|unsupported|failed
      const phase = phaseState[0];
      const setPhase = phaseState[1];
      const errState = React.useState('');
      const errMsg = errState[0];
      const coverState = React.useState(true);
      const covering = coverState[0];
      const setCovering = coverState[1];
      const hostRef = React.useRef(null);

      React.useEffect(() => {
        let cancelled = false;
        let lease = null;
        let element = null;
        let pollTimer = null;
        const bridge =
          typeof window !== 'undefined' && window.dshDesktop && window.dshDesktop.browser
            ? window.dshDesktop.browser
            : null;

        if (!bridge) {
          setPhase('unsupported');
          return undefined;
        }

        const startPolling = () => {
          if (pollTimer) return;
          pollTimer = setInterval(async () => {
            if (cancelled || !element) {
              if (pollTimer) clearInterval(pollTimer);
              pollTimer = null;
              return;
            }
            try {
              const out = await element.executeJavaScript(PROBE_JS, true);
              const data = JSON.parse(out);
              const onChat =
                data && data.href && data.href.indexOf(CHAT_HOST) !== -1 && !data.error;
              const signedIn = !!(data && data.ls && data.ls.userToken);
              if (onChat) {
                // Settled: drop the cover so the guest appears in one frame.
                setCovering(false);
                if (signedIn) {
                  partitionWarmed = true;
                  setPhase(prev => (prev === 'ready' ? prev : 'ready'));
                  writeSnapshot(data);
                } else {
                  setPhase(prev => (prev === 'ready' ? prev : 'login'));
                }
              }
            } catch (e) { /* guest not ready yet */ }
          }, 800);
        };

        // Stage machine over guest documents:
        // 0 bootstrap (about:blank#lease) -> 1 origin doc (inject snapshot)
        // -> 2 chat page ready -> poll.
        let stage = 0;
        const needRestore = !partitionWarmed && !!readSnapshot();
        const onDomReady = async () => {
          if (cancelled || !element) return;
          if (stage === 0) {
            stage = 1;
            setCovering(true);
            try {
              await element.loadURL(needRestore ? CHAT_ORIGIN_DOC : CHAT_URL);
            } catch (e) { /* did-fail-load handles */ }
            return;
          }
          if (stage === 1) {
            stage = 2;
            if (needRestore) {
              const snap = readSnapshot();
              if (snap) {
                try {
                  const result = await element.executeJavaScript(restoreJs(snap), true);
                  if (result === 'ok') {
                    try { await element.loadURL(CHAT_URL); } catch (e) { /* handled */ }
                    return;
                  }
                } catch (e) { /* fall through */ }
              }
            }
            try { await element.loadURL(CHAT_URL); } catch (e) { /* handled */ }
            return;
          }
          startPolling();
          // Safety net: never cover the guest for more than 8 seconds.
          setTimeout(() => {
            if (!cancelled) setCovering(false);
          }, 8000);
        };

        (async () => {
          try {
            const reservation = await bridge.acquire(WORKSPACE_KEY);
            if (cancelled) {
              bridge.release(reservation.lease);
              return;
            }
            lease = reservation.lease;
            const el = document.createElement('webview');
            el.setAttribute('name', reservation.lease);
            el.setAttribute('partition', reservation.partition);
            el.setAttribute('allowpopups', '');
            el.setAttribute('src', 'about:blank#' + reservation.lease);
            el.style.cssText =
              'display:flex;flex:1 1 auto;min-width:0;min-height:0;width:100%;height:100%;border:0;-webkit-app-region:no-drag;';
            el.addEventListener('dom-ready', onDomReady);
            element = el;
            const host = hostRef.current;
            if (host && !cancelled) {
              host.appendChild(el);
              // Electron webview guest views can misplace their internal view
              // after late resizes; drive explicit pixel dimensions too.
              const sync = () => {
                if (!element || !host.isConnected) return;
                const r = host.getBoundingClientRect();
                element.style.width = Math.max(1, Math.floor(r.width)) + 'px';
                element.style.height = Math.max(1, Math.floor(r.height)) + 'px';
              };
              sync();
              requestAnimationFrame(sync);
              setTimeout(sync, 300);
              const ro = new ResizeObserver(sync);
              ro.observe(host);
              el.__dshResizeObserver = ro;
            }
          } catch (e) {
            if (!cancelled) {
              setErrMsg(String((e && e.message) || e));
              setPhase('failed');
            }
          }
        })();

        return () => {
          cancelled = true;
          if (pollTimer) clearInterval(pollTimer);
          if (element) {
            if (element.__dshResizeObserver) {
              try { element.__dshResizeObserver.disconnect(); } catch (e) { /* ignore */ }
            }
            if (element.remove) element.remove();
          }
          element = null;
          if (lease) {
            try { bridge.release(lease); } catch (e) { /* ignore */ }
            lease = null;
          }
        };
      }, []);

      if (phase === 'unsupported' || phase === 'failed') {
        return h(
          'div',
          {
            style: {
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 24,
              textAlign: 'center',
              fontSize: 13,
              opacity: 0.85,
            },
          },
          h(
            'div',
            { style: { maxWidth: 420 } },
            phase === 'unsupported'
              ? 'The desktop browser bridge is unavailable here. / 当前窗口没有桌面 Browser 桥接。'
              : 'Could not create the embedded guest. / 内嵌 webview 创建失败。',
            errMsg ? h('div', { style: { fontSize: 12, opacity: 0.7 } }, errMsg) : null,
          ),
          h(
            'button',
            {
              onClick: () => { if (!openSidebarBrowser()) openExternal(); },
              style: buttonStyle,
            },
            'Open in the right-Sidebar Browser / 在右侧边栏 Browser 打开',
          ),
        );
      }

      return h(
        'div',
        { style: { position: 'relative', display: 'flex', flex: '1 1 auto', flexDirection: 'column', height: '100%', minHeight: 0 } },
        h('div', {
          ref: hostRef,
          style: { position: 'relative', display: 'flex', flex: '1 1 auto', width: '100%', minHeight: 0 },
        }),
        covering
          ? h(
              'div',
              {
                style: {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  backgroundColor: 'var(--dsw-alias-bg-base, #ffffff)',
                  color: 'var(--dsw-alias-label-primary, inherit)',
                },
              },
              'Loading DeepSeek Chat… / 正在加载…',
            )
          : null,
      );
    }

    function WebFallback() {
      return h(
        'div',
        {
          style: {
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
            color: 'var(--dsw-text, inherit)',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.6,
          },
        },
        h('div', { style: { fontWeight: 600, fontSize: 15 } }, 'DeepSeek Chat'),
        h(
          'div',
          { style: { maxWidth: 420, opacity: 0.85 } },
          'chat.deepseek.com refuses embedding (CSP frame-ancestors \'none\'), ' +
            'so the Web GUI cannot host it inline. Open it in a browser tab — ' +
            'its own login storage keeps you signed in across visits.',
        ),
        h(
          'div',
          { style: { maxWidth: 420, opacity: 0.7, fontSize: 12 } },
          'Uses the chat web app\u2019s free basic service — everyday chats cost no API quota. ' +
            '\u4f7f\u7528\u7f51\u9875\u7248\u514d\u8d39\u57fa\u7840\u670d\u52a1\uff0c\u65e5\u5e38\u5bf9\u8bdd\u4e0d\u6d88\u8017 API \u989d\u5ea6\u3002',
        ),
        h(
          'button',
          { onClick: openExternal, style: buttonStyle },
          'Open DeepSeek Chat',
        ),
        h(
          'div',
          { style: { maxWidth: 420, opacity: 0.6, fontSize: 12 } },
          'In the DeepSeek Harness desktop app this panel embeds the chat ' +
            'directly with a persistent remembered session.',
        ),
      );
    }

    function Panel() {
      return h(
        'div',
        {
          style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            minHeight: 0,
            backgroundColor: 'var(--dsw-alias-bg-base, #ffffff)',
            color: 'var(--dsw-alias-label-primary, inherit)',
          },
        },
        isElectron() ? h(ElectronEmbed) : h(WebFallback),
      );
    }

    /** Main-panel wrapper: guarantees visible height in the layout's `main` slot. */
    function MainPanel() {
      return h(
        'div',
        {
          style: {
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: 'calc(100vh - var(--dsh-frame-top-clearance, 48px))',
          },
        },
        h(Panel),
      );
    }

    function ChatIcon() {
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            width: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
          },
          'aria-hidden': true,
        },
        h(
          'svg',
          { viewBox: '0 0 64 64', width: 16, height: 16 },
          h('circle', { cx: 32, cy: 32, r: 30, fill: '#4d6bfe' }),
          h('path', {
            d: 'M20 24a12 10 0 0 1 24 0 12 10 0 0 1-10 9.9V44l-6-5h-2a12 10 0 0 1-6-15z',
            fill: '#ffffff',
          }),
          h('circle', { cx: 27, cy: 25, r: 2, fill: '#4d6bfe' }),
          h('circle', { cx: 37, cy: 25, r: 2, fill: '#4d6bfe' }),
        ),
      );
    }

    return {
      inject: ['sidebarRight', 'sidebarRightTabs', 'slots'],
      apply(ctx) {
        pluginCtx = ctx;
        ctx.effect(() => {
          // Left sidebar: a global panel entry (row in sidebar.panellist whose
          // id addresses the component registered under the same key in the
          // layout's root-scoped `main` slot, like the Plugins page).
          const disposeList = ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: TAB_ID, order: 50, label: 'DeepSeek Chat' },
              ChatIcon,
            ),
          );
          const disposeMain = ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: TAB_ID }, MainPanel),
          );

          // Right sidebar: a tab type with a guide entry card.
          const disposeType = ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => 'DeepSeek Chat',
            keepMounted: true,
            guide: [
              {
                id: 'deepseek-chat',
                order: 50,
                title: () => 'DeepSeek Chat',
                description: () => 'Open chat.deepseek.com beside your session',
              },
            ],
          });

          // The keyed body seat registers directly per the sidebar-right
          // contract (the type's id is its key); both stages share this effect.
          const disposeBody = ctx.slots.register(
            { name: 'sidebar.right.pane.tab', key: TAB_ID },
            Panel,
          );

          return () => {
            disposeBody();
            disposeType();
            disposeMain();
            disposeList();
          };
        });
      },
    };
  },
});
