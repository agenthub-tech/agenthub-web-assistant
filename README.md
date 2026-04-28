# Agenthub Web Assistant

基于 Agenthub JS SDK 构建的 Web 嵌入式智能助手，提供完整的对话 UI 和网页操作能力。

## 安装

### CDN 引入

```html
<script src="https://your-cdn/aa.js"></script>
<script>
  AA.init({ channelKey: 'your-channel-key' });
</script>
```

### NPM 安装

```bash
npm install agenthub-web-assistant
```

```typescript
import { AA } from 'agenthub-web-assistant';

AA.init({
  channelKey: 'your-channel-key',
  apiBase: 'https://your-agenthub-server'
});
```

## 功能特性

- 悬浮按钮 + 对话面板 UI
- 自然语言驱动的 DOM 操作
- 虚拟鼠标动画
- 元素高亮提示
- 跨页面任务恢复
- 用户确认弹窗
- 主题定制

## 内置 Skills

| Skill | 说明 |
|-------|------|
| PageSkill | 页面感知、DOM 快照提取 |
| DOMSkill | 点击、输入、滚动、表单填写 |
| NavigationSkill | 页面跳转、路由监听 |
| ClipboardSkill | 读写剪贴板 |
| DialogSkill | 用户确认、信息展示 |
| WaitSkill | 等待元素/时长 |
| HttpSkill | HTTP 请求 |

## API

### `AA.init(options)`

初始化助手，显示悬浮按钮。

```typescript
AA.init({
  channelKey: 'your-channel-key',
  apiBase: 'https://your-agenthub-server',
  position: 'bottom-right',  // 悬浮按钮位置
  theme: { primaryColor: '#1890ff' }  // 主题配置
});
```

### `AA.identify(user)`

标识当前用户身份。

```typescript
AA.identify({
  userId: 'user-123',
  name: '张三',
  metadata: { vip: true }
});
```

### `AA.reset()`

重置用户状态（登出）。

## 构建

```bash
npm install
npm run build
```

产物：
- `dist/aa.js` — IIFE 格式（CDN 使用）
- `dist/aa.esm.js` — ESM 格式
- `dist/aa.min.js` — 压缩版

## License

MIT
