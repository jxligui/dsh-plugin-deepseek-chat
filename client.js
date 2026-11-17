/**
 * Client half of the DeepSeek Chat plugin.
 *
 * Left sidebar: a global panel entry (`sidebar.panellist` row + `main` keyed slot).
 * Right sidebar: a tab type with a guide entry card.
 *
 * Sidebar visibility follows the plugin's own configuration (Settings service,
 * namespace = the profile entry id `deepseek-chat`): `showInLeftSidebar` and
 * `showInRightSidebar` volatile booleans are edited on the plugin's row page on
 * the Plugins page (`plugins.row.config` slot) and subscribed to here through
 * `ctx.configForms`, so toggles apply live. At least one entry always stays
 * visible — a config of "both off" falls back to the left sidebar, and the
 * settings form disables the last enabled switch.
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
    /** Profile entry id of this bundle's row; also the Settings namespace. */
    const ENTRY_ID = 'deepseek-chat';
    /** Key of the row's configuration page on the Plugins page. */
    const ROW_CONFIG_KEY = 'dsh-plugin-deepseek-chat#deepseek-chat';

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

    /** Resolved sidebar visibility with the "at least one visible" floor. */
    function resolveVisibility(value) {
      const v = value || {};
      let left = v.showInLeftSidebar !== false;
      let right = v.showInRightSidebar !== false;
      if (!left && !right) left = true; // keep one entry always reachable
      return { left, right };
    }

    /** Register the sidebar entries the resolved visibility asks for. */
    function registerEntries(ctx, visible) {
      const disposers = [];
      if (visible.left) {
        // Left sidebar: a global panel entry (row in sidebar.panellist whose
        // id addresses the component registered under the same key in the
        // layout's root-scoped `main` slot, like the Plugins page).
        disposers.push(ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: TAB_ID, order: 50, label: 'DeepSeek Chat' },
            ChatIcon,
          ),
        ));
        disposers.push(ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: TAB_ID }, MainPanel),
        ));
      }
      if (visible.right) {
        // Right sidebar: a tab type with a guide entry card.
        disposers.push(ctx.sidebarRightTabs.register({
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
        }));
        // The keyed body seat registers directly per the sidebar-right
        // contract (the type's id is its key).
        disposers.push(ctx.slots.register(
          { name: 'sidebar.right.pane.tab', key: TAB_ID },
          Panel,
        ));
      }
      return () => disposers.forEach(dispose => { try { dispose(); } catch (e) { /* already gone */ } });
    }

    const settingsLabelStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      padding: '10px 0',
      fontSize: 13,
      lineHeight: 1.5,
    };
    const settingsTextStyle = { flex: '1 1 auto', margin: 0 };
    const settingsTitleStyle = { fontWeight: 600, margin: '0 0 2px' };
    const settingsDescStyle = { opacity: 0.7, margin: 0, fontSize: 12 };

    /** One labeled checkbox row; the last enabled switch cannot be turned off. */
    function SettingRow(props) {
      const { label, description, checked, disabled, onChange } = props;
      const id = 'dsh-deepseek-chat-setting-' + props.name;
      return h(
        'div',
        { style: settingsLabelStyle },
        h(
          'div',
          { style: settingsTextStyle },
          h('label', { style: settingsTitleStyle, htmlFor: id }, label),
          h('p', { style: settingsDescStyle }, description),
        ),
        h('input', {
          id,
          type: 'checkbox',
          checked,
          disabled,
          onChange: event => onChange(event.target.checked),
          style: { flex: '0 0 auto', width: 16, height: 16, margin: 0, cursor: disabled ? 'default' : 'pointer' },
        }),
      );
    }

    /**
     * The shared sidebar-visibility settings body: two switches (left and
     * right sidebar) with draft staging, Save, and Discard. Reads its snapshot
     * through the injected accessors, so the same body serves both the
     * Plugins page's row form (page-owned state) and the Settings window's
     * plugin tab (our own live scope).
     */
    function SidebarSettingsBody(props) {
      const { getSnapshot, subscribe, mutate } = props;
      const snapState = React.useState(getSnapshot);
      const snap = snapState[0];
      const setSnap = snapState[1];
      const draftState = React.useState(null);
      const draft = draftState[0];
      const setDraft = draftState[1];
      const busyState = React.useState(false);
      const saving = busyState[0];
      const setSaving = busyState[1];
      const noteState = React.useState('');
      const note = noteState[0];
      const setNote = noteState[1];
      const seenRef = React.useRef(null);

      // Follow Host publications when a subscription is available, and
      // re-stage the draft on every new accepted snapshot.
      React.useEffect(() => {
        setSnap(getSnapshot());
        if (!subscribe) return undefined;
        return subscribe(() => setSnap(getSnapshot()));
      }, [getSnapshot, subscribe, setSnap]);
      React.useEffect(() => {
        if (!snap || seenRef.current === snap) return;
        seenRef.current = snap;
        setDraft(resolveVisibility(snap.value));
        setNote('');
      }, [snap, setDraft]);

      if (!snap || snap.status !== 'ready' || !draft) {
        return h(
          'div',
          { style: { padding: '12px 0', fontSize: 13, opacity: 0.75 } },
          'Settings are unavailable here. / 此处暂不可编辑设置。',
        );
      }
      const writable = snap.writable !== false;
      const busy = saving || !writable;
      const lastStanding = draft.left !== draft.right; // exactly one enabled
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' } },
        h('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 4 } }, 'DeepSeek Chat'),
        h(SettingRow, {
          name: 'left',
          label: 'Show in the left sidebar / 在左侧栏显示',
          description: 'The DeepSeek Chat row in the left navigation and its main-area panel. / 左侧导航中的 DeepSeek Chat 入口及主内容区面板。',
          checked: draft.left,
          disabled: busy || (draft.left && lastStanding),
          onChange: next => { setNote(''); setDraft(prev => ({ left: next, right: prev.right })); },
        }),
        h(SettingRow, {
          name: 'right',
          label: 'Show in the right sidebar / 在右侧栏显示',
          description: 'The DeepSeek Chat tab beside your session in the right Sidebar. / 右侧边栏中随会话打开的 DeepSeek Chat 标签页。',
          checked: draft.right,
          disabled: busy || (draft.right && lastStanding),
          onChange: next => { setNote(''); setDraft(prev => ({ left: prev.left, right: next })); },
        }),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 } },
          h(
            'button',
            {
              disabled: busy,
              onClick: async () => {
                const accepted = resolveVisibility(snap.value);
                const ops = [];
                if (draft.left !== accepted.left) ops.push({ op: 'set', path: ['showInLeftSidebar'], value: draft.left });
                if (draft.right !== accepted.right) ops.push({ op: 'set', path: ['showInRightSidebar'], value: draft.right });
                if (ops.length === 0) { setNote('已保存 / Saved'); return; }
                setSaving(true);
                try {
                  // Fence the write with the revision we read; a refusal is
                  // most often a stale-revision conflict, so retry once with
                  // the latest known revision before reporting failure.
                  let ok = await mutate(ops, snap.revision);
                  if (!ok) ok = await mutate(ops);
                  setNote(ok
                    ? '已保存，立即生效。 / Saved and applied.'
                    : '保存被 Host 拒绝，请稍后重试。 / Save was refused by the Host, please retry.');
                } catch (e) {
                  setNote('保存失败：' + String((e && e.message) || e));
                } finally {
                  setSaving(false);
                }
              },
              style: { ...buttonStyle, padding: '5px 14px', opacity: busy ? 0.6 : 1 },
            },
            saving ? 'Saving… / 保存中…' : 'Save / 保存',
          ),
          note ? h('span', { style: { fontSize: 12, opacity: 0.75 } }, note) : null,
          !writable ? h('span', { style: { fontSize: 12, opacity: 0.6 } }, '只读 / Read-only') : null,
        ),
        h(
          'div',
          { style: { fontSize: 12, opacity: 0.6 } },
          '至少保留一处显示。 / At least one sidebar entry stays visible.',
        ),
      );
    }

    /**
     * The plugin's row page on the Plugins page: the shared settings body
     * driven by the page owner's `form` (state + mutate for this entry).
     */
    function RowConfigPage(props) {
      const { view, form } = props;
      if (view === 'summary') {
        return 'Choose where DeepSeek Chat shows: left sidebar, right sidebar, or both. / 选择 DeepSeek Chat 的显示位置：左侧栏、右侧栏或两者。';
      }
      if (!form) {
        return h(
          'div',
          { style: { padding: '12px 0', fontSize: 13, opacity: 0.75 } },
          'Settings are unavailable here. / 此处暂不可编辑设置。',
        );
      }
      return h(SidebarSettingsBody, {
        getSnapshot: () => form.state,
        mutate: (ops, revision) => form.mutate(ops, revision),
      });
    }

    return {
      inject: ['sidebarRight', 'sidebarRightTabs', 'slots'],
      apply(ctx) {
        pluginCtx = ctx;

        /** The shared settings scope for our entry, or undefined without Settings. */
        const scopeOf = () => {
          try {
            const configForms = ctx.get('configForms');
            return configForms && typeof configForms.get === 'function'
              ? configForms.get(ENTRY_ID)
              : undefined;
          } catch (e) {
            return undefined;
          }
        };

        /** Render the settings body against the live scope, or a notice without it. */
        const renderSettingsBody = () => {
          const scope = scopeOf();
          if (!scope) {
            return h(
              'div',
              { style: { padding: '12px 0', fontSize: 13, opacity: 0.75 } },
              'Settings are unavailable here. / 此处暂不可编辑设置。',
            );
          }
          return h(SidebarSettingsBody, {
            getSnapshot: () => scope.getSnapshot(),
            subscribe: listener => scope.subscribe(listener),
            mutate: (ops, revision) => scope.mutate(ops, revision),
          });
        };

        // The plugin's own settings page: a row page on the Plugins page,
        // which gains a Configure control for the entry.
        ctx.effect(() =>
          ctx.slots.inject('plugins.row.config', () =>
            ctx.slots.register({ name: 'plugins.row.config', key: ROW_CONFIG_KEY }, RowConfigPage),
          ), 'deepseek-chat: row settings page');

        // The Settings window: a dedicated "DeepSeek Chat" section in the
        // settings navigation. Registered on the main fiber like every other
        // contribution of this plugin; the body reads the Settings service
        // lazily, so a deployment without it only disables the editors.
        ctx.effect(() =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'deepseek-chat',
                order: 60,
                label: () => 'DeepSeek Chat',
              },
              renderSettingsBody,
            ),
          ), 'deepseek-chat: settings section');

        // Sidebar entries. This effect is the SINGLE owner of the sidebar
        // registrations: it registers from the resolved volatile configuration
        // when the Settings forms are available (defaults when not), and every
        // later accepted snapshot re-registers exactly the visible entries.
        // Everything is guarded, so a failure here can never tear down the
        // other contributions of this plugin.
        ctx.effect(() => {
          const scope = scopeOf();
          let disposeEntries = null;
          let last = null;
          const reconcile = () => {
            try {
              const snapshot = scope ? scope.getSnapshot() : {};
              const visible = resolveVisibility(snapshot.value);
              const key = (visible.left ? 'L' : '-') + (visible.right ? 'R' : '-');
              if (key === last) return;
              last = key;
              if (disposeEntries) disposeEntries();
              disposeEntries = registerEntries(ctx, visible);
            } catch (e) {
              console.warn('dsh-plugin-deepseek-chat: visibility reconcile failed', e);
            }
          };
          reconcile();
          let unwatch = null;
          if (scope) {
            try {
              unwatch = scope.subscribe(reconcile);
            } catch (e) {
              console.warn('dsh-plugin-deepseek-chat: visibility subscribe failed', e);
            }
          }
          return () => {
            if (unwatch) { try { unwatch(); } catch (e) { /* gone */ } }
            if (disposeEntries) { try { disposeEntries(); } catch (e) { /* gone */ } }
          };
        }, 'deepseek-chat: sidebar visibility');
      },
    };
  },
});
