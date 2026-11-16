/**
 * Client half of the DeepSeek Chat plugin.
 *
 * Registers a right-Sidebar tab type with a guide entry. The tab body embeds
 * https://chat.deepseek.com/ :
 *  - Desktop (Electron): an <webview> backed by the persistent partition
 *    `persist:dsh-deepseek-chat`, so cookies/localStorage survive reloads and
 *    restarts — log in once and stay signed in.
 *  - Web: chat.deepseek.com answers `CSP: frame-ancestors 'none'`, so an
 *    iframe is refused by the site itself. The body then explains this and
 *    offers to open the chat in a normal browser tab, where the site's own
 *    login storage persists.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-deepseek-chat',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const CHAT_URL = 'https://chat.deepseek.com/';
    const TAB_ID = 'dsh-plugin-deepseek-chat';
    const TAB_KIND = 'deepseek-chat';
    const PARTITION = 'persist:dsh-deepseek-chat';
    const isElectron = () =>
      typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent || '');

    function ElectronEmbed() {
      const state = React.useState('loading');
      const phase = state[0];
      const setPhase = state[1];
      React.useEffect(() => {
        const el = document.getElementById('dsh-deepseek-chat-webview');
        if (!el || typeof el.addEventListener !== 'function') {
          setPhase('unsupported');
          return undefined;
        }
        const ok = () => setPhase('loaded');
        const fail = () => setPhase('failed');
        el.addEventListener('dom-ready', ok);
        el.addEventListener('load-commit', ok);
        el.addEventListener('did-fail-load', fail);
        el.addEventListener('crashed', fail);
        const timer = setTimeout(() => {
          setPhase(prev => (prev === 'loading' ? 'failed' : prev));
        }, 10000);
        return () => {
          clearTimeout(timer);
          el.removeEventListener('dom-ready', ok);
          el.removeEventListener('load-commit', ok);
          el.removeEventListener('did-fail-load', fail);
          el.removeEventListener('crashed', fail);
        };
      }, []);
      return h(
        'div',
        { style: { position: 'relative', flex: '1 1 auto', minHeight: 0 } },
        h(
          'div',
          {
            style: {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 24,
              textAlign: 'center',
              fontSize: 13,
              opacity: 0.85,
              zIndex: 0,
            },
          },
          phase === 'loading'
            ? 'Loading DeepSeek Chat… / 正在加载 DeepSeek Chat…'
            : 'The embedded webview did not load. Open the chat in a browser tab instead. / 内嵌 webview 未能加载，请改用浏览器打开。',
        ),
        h('webview', {
          id: 'dsh-deepseek-chat-webview',
          src: CHAT_URL,
          partition: PARTITION,
          allowpopups: 'true',
          style: {
            display: 'block',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: 1,
          },
        }),
      );
    }

    function WebFallback() {
      const openChat = () => window.open(CHAT_URL, '_blank', 'noopener');
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
          {
            onClick: openChat,
            style: {
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid var(--dsw-border, rgba(0,0,0,0.15))',
              background: 'var(--dsw-primary, #4d6bfe)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            },
          },
          'Open DeepSeek Chat',
        ),
        h(
          'div',
          { style: { maxWidth: 420, opacity: 0.6, fontSize: 12 } },
          'In the DeepSeek Harness desktop app this panel embeds the chat ' +
            'directly in a persistent Electron <webview> partition.',
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
            minHeight: 'calc(100vh - var(--dsh-frame-top-clearance, 48px))',
            backgroundColor: 'var(--dsw-bg, #ffffff)',
            color: 'var(--dsw-text, #1a1a1a)',
          },
        },
        isElectron() ? h(ElectronEmbed) : h(WebFallback),
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
      inject: ['sidebarRightTabs', 'slots'],
      apply(ctx) {
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
            ctx.slots.register({ name: 'main', key: TAB_ID }, Panel),
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
                title: 'DeepSeek Chat',
                description: 'Open chat.deepseek.com beside your session',
                order: 50,
              },
            ],
          });

          const disposeBody = ctx.slots.register(
            { name: 'sidebar.right.pane.tab', key: TAB_ID },
            Panel,
          );

          return () => {
            disposeMain();
            disposeList();
            disposeBody();
            disposeType();
          };
        });
      },
    };
  },
});
