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
      return h('webview', {
        src: CHAT_URL,
        partition: PARTITION,
        allowpopups: 'true',
        style: {
          display: 'block',
          flex: '1 1 auto',
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: 'var(--dsw-bg, #ffffff)',
        },
      });
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
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            minHeight: 0,
          },
        },
        isElectron() ? h(ElectronEmbed) : h(WebFallback),
      );
    }

    return {
      inject: ['sidebarRightTabs', 'slots'],
      apply(ctx) {
        ctx.effect(() => {
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
            disposeBody();
            disposeType();
          };
        });
      },
    };
  },
});
