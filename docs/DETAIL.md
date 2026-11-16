# DeepSeek Chat 面板

在 DeepSeek Harness 右侧边栏新增 **DeepSeek Chat** 标签页，并贡献一张引导卡片。

## 💰 免费使用，节约成本

本面板直接加载 **chat.deepseek.com 网页版**。网页版对话使用 DeepSeek 提供的
**免费基础服务**，不消耗 API 额度、不产生 API 调用费用。日常问答、查资料、
草拟文案这类轻量需求走网页版即可覆盖，把宝贵的 API 余额留给 Harness 里
真正需要程序化调用的任务，从而显著节约成本。

## 使用方法

1. **左侧边栏**：展开左侧导航栏，点击 **DeepSeek Chat** 行（收起时是蓝色对话气泡图标），面板会在主内容区打开。
2. **右侧边栏**（可选）：打开右侧边栏，在引导页点击 **DeepSeek Chat** 卡片。
3. 桌面端：直接在面板内聊天，登录一次即可；Web 端：点击按钮在新浏览器标签页打开。

## 行为说明

- **桌面端（Electron 应用）**：面板用 Electron `<webview>` 内嵌
  `https://chat.deepseek.com/`，使用持久分区 `persist:dsh-deepseek-chat`。
  Cookie 和 `localStorage` 跨页面刷新、跨应用重启保留 —— 登录一次，长期有效。
- **Web GUI**：`chat.deepseek.com` 响应头带
  `Content-Security-Policy: frame-ancestors 'none'`，站点自身拒绝 iframe 内嵌，
  任何插件都无法绕过。此时面板显示说明并提供 **Open DeepSeek Chat** 按钮，
  在普通浏览器标签页打开 —— 网站自身的登录存储同样让你保持登录状态。

## 为什么不注入凭据？

DeepSeek Harness 的账号凭据体系（`dsh-credentials`）保存的是 API-key 形态的
凭据（`DEEPSEEK_API_KEY` 引用与 `<owner>/<id>` 记录），并非 chat.deepseek.com
网页版的同源 web token，没有可注入的登录态；持久分区"登录一次"是受支持的路线。

## 限制

- Web 端内嵌被站点 CSP 禁止，属于设计上的降级，而非缺陷。
- 桌面端的下载、原生弹窗等访客权限遵循 Harness Desktop 的 webview 策略；
  获批准的弹窗会在侧边栏标签页中打开。
- 标签页声明了 `keepMounted`，切换标签或会话时聊天页面保持存活。
