# DeepSeek Chat 面板

在 DeepSeek Harness 左侧导航新增 **DeepSeek Chat** 入口，并在右侧边栏提供同名标签页。

## 支持的平台

| 平台 | 行为 |
|---|---|
| **桌面版 Windows / macOS / Linux**（Electron） | 完整体验：面板通过官方 Browser 租约桥内嵌 `chat.deepseek.com`，登录一次后自动快照，重启应用自动恢复登录态 |
| **Web GUI**（浏览器访问） | 降级模式：站点 CSP 禁止 iframe 内嵌，面板提供说明与一键外部打开；登录态由浏览器自身存储保持 |

说明：桌面版依赖 Harness 桌面预加载提供的 Browser 租约桥（`dshDesktop.browser`）；
桥不可用或创建失败时，面板自动降级为"在右侧边栏 Browser 打开 / 系统浏览器打开"。

## 💰 免费使用，节约成本

本面板直接加载 **chat.deepseek.com 网页版**。网页版对话使用 DeepSeek 提供的
**免费基础服务**，不消耗 API 额度、不产生 API 调用费用。日常问答、查资料、
草拟文案这类轻量需求走网页版即可覆盖，把宝贵的 API 余额留给 Harness 里
真正需要程序化调用的任务，从而显著节约成本。

## 使用方法

1. **左侧边栏**：展开左侧导航栏，点击 **DeepSeek Chat** 行（收起时是蓝色对话气泡图标），面板会在主内容区打开。
2. **右侧边栏**（可选）：打开右侧边栏，在引导页点击 **DeepSeek Chat** 卡片。
3. 桌面端：直接在面板内聊天，登录一次即可；Web 端：点击按钮在新浏览器标签页打开。

## 设置：自定义显示位置

**设置窗口 → DeepSeek Chat**：设置导航里新增的独立分区（与「通用设置」「模型」并列），
打开即可开关：

- **在左侧栏显示**（默认开）：左侧导航入口 + 主内容区面板。
- **在右侧栏显示**（默认开）：右侧边栏中的 DeepSeek Chat 标签页。

同样的设置也在 **插件（Plugins）页面 → DeepSeek Chat 卡片 → Configure（配置）**。

修改后点击 **Save（保存）** 即时生效，无需重启；**Discard**（放弃修改）可还原。
插件保证**至少一处显示**：表单会禁用最后一个处于开启状态的开关，配置里"两处都关"
也会按"仅左侧栏显示"处理。

## 行为说明

- **桌面端（Electron 应用，Windows/macOS/Linux）**：通过 `window.dshDesktop.browser`
  租约桥取得 webview 租约后内嵌 `https://chat.deepseek.com/`。租约分区为进程内存态，
  插件在登录后自动把站点登录态（localStorage + 可读 cookie）快照到应用本地存储，
  每次启动先注入快照再加载——实现"登录一次，重启不丢"。
- **Web GUI**：`chat.deepseek.com` 响应头带
  `Content-Security-Policy: frame-ancestors 'none'`，站点自身拒绝 iframe 内嵌，
  任何插件都无法绕过。此时面板显示说明并提供 **Open DeepSeek Chat** 按钮，
  在普通浏览器标签页打开 —— 网站自身的登录存储同样让你保持登录状态。

## 为什么不注入凭据？

DeepSeek Harness 的账号凭据体系（`dsh-credentials`）保存的是 API-key 形态的
凭据（`DEEPSEEK_API_KEY` 引用与 `<owner>/<id>` 记录），并非 chat.deepseek.com
网页版的同源 web token，没有可注入的登录态；租约内嵌 + 登录态快照是沙箱策略内
唯一可行的持久化路线。

## 限制

- Web 端内嵌被站点 CSP 禁止，属于设计上的降级，而非缺陷。
- 桌面端登录态快照只能覆盖 JS 可读的存储；若站点的关键会话 cookie 为 httpOnly
  且登录校验强依赖它，重启恢复可能退化为要求重新登录（实测 Windows 下正常）。
- 桌面端的下载、原生弹窗等访客权限遵循 Harness Desktop 的 webview 策略。
- 右侧边栏标签声明了 `keepMounted`，切换标签或会话时聊天页面保持存活。
