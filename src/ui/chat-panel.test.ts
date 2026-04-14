// ChatPanel unit + property tests
// 需求：10.1、10.2、10.4、11.1、11.2、11.3、11.4、12.1、12.2、12.4、13.1、13.2、13.3、13.4、15.3、15.4、15.5

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ChatPanel } from './chat-panel';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePanel(theme?: ConstructorParameters<typeof ChatPanel>[0]) {
  return new ChatPanel(theme);
}

function cleanup(panel: ChatPanel) {
  panel.getElement().remove();
}

// ── Task 14.1: 基础结构 ───────────────────────────────────────────────────────

describe('ChatPanel — 基础结构 (14.1)', () => {
  let panel: ChatPanel;

  beforeEach(() => { panel = makePanel(); });
  afterEach(() => { cleanup(panel); });

  it('面板挂载到 document.body', () => {
    expect(document.body.contains(panel.getElement())).toBe(true);
  });

  it('面板默认隐藏 (display:none)', () => {
    expect(panel.getElement().style.display).toBe('none');
  });

  it('show() 使面板可见', () => {
    panel.show();
    expect(panel.getElement().style.display).toBe('flex');
  });

  it('hide() 隐藏面板', () => {
    panel.show();
    panel.hide();
    expect(panel.getElement().style.display).toBe('none');
  });

  it('面板包含消息列表、输入框、发送按钮', () => {
    expect(panel.getMessageListEl()).not.toBeNull();
    expect(panel.getElement().querySelector('textarea[data-aa-sdk="true"]')).not.toBeNull();
    expect(panel.getElement().querySelector('button[aria-label="发送"]')).not.toBeNull();
  });

  it('所有 SDK DOM 元素携带 data-aa-sdk="true"', () => {
    const root = panel.getElement();
    // Root itself has the attribute
    expect(root.getAttribute('data-aa-sdk')).toBe('true');
    // All direct SDK-created HTML elements (div, span, button, textarea) have the attribute
    // (SVG child elements like <circle>, <path> are inline SVG internals and are excluded)
    const sdkHtmlEls = Array.from(root.querySelectorAll('div, span, button, textarea, img'));
    sdkHtmlEls.forEach(el => {
      expect(el.getAttribute('data-aa-sdk')).toBe('true');
    });
  });

  it('onSend 注册回调，Enter 键触发', () => {
    const handler = vi.fn();
    panel.onSend(handler);
    panel.show();
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'hello';
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(handler).toHaveBeenCalledWith('hello', undefined);
  });
});

// ── Task 14.2: 消息气泡管理 ───────────────────────────────────────────────────

describe('ChatPanel — 消息气泡管理 (14.2)', () => {
  let panel: ChatPanel;

  beforeEach(() => { panel = makePanel(); panel.show(); });
  afterEach(() => { cleanup(panel); });

  it('addMessage 返回唯一 id', () => {
    const id1 = panel.addMessage('user');
    const id2 = panel.addMessage('assistant');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^msg_/);
  });

  it('用户消息气泡右对齐', () => {
    panel.addMessage('user');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    expect(wrapper.style.justifyContent).toBe('flex-end');
  });

  it('AA 消息气泡左对齐', () => {
    panel.addMessage('assistant', 'pending');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    expect(wrapper.style.justifyContent).toBe('flex-start');
  });

  it('pending 状态显示加载动画 dots', () => {
    panel.addMessage('assistant', 'pending');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    expect(wrapper.innerHTML).toContain('aa-dot');
  });

  it('appendDelta 追加文本到气泡', () => {
    const id = panel.addMessage('assistant', 'streaming');
    panel.appendDelta(id, 'Hello');
    panel.appendDelta(id, ' World');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    const contentEl = wrapper.querySelector('[data-aa-content]') as HTMLElement;
    expect(contentEl.textContent).toBe('Hello World');
  });

  it('setMessageState pending→streaming 清除 dots，显示内容', () => {
    const id = panel.addMessage('assistant', 'pending');
    panel.appendDelta(id, 'streaming text');
    panel.setMessageState(id, 'streaming');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    const contentEl = wrapper.querySelector('[data-aa-content]') as HTMLElement;
    expect(contentEl).not.toBeNull();
    expect(contentEl.textContent).toBe('streaming text');
    expect(wrapper.innerHTML).not.toContain('aa-dot');
  });

  it('setMessageState streaming→done 保留内容', () => {
    const id = panel.addMessage('assistant', 'streaming');
    panel.appendDelta(id, 'final');
    panel.setMessageState(id, 'done');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    const contentEl = wrapper.querySelector('[data-aa-content]') as HTMLElement;
    expect(contentEl.textContent).toBe('final');
  });

  it('error 状态气泡有错误样式', () => {
    const id = panel.addMessage('assistant', 'error');
    panel.setMessageState(id, 'error');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    const bubble = wrapper.firstElementChild as HTMLElement;
    expect(bubble.style.background).toBe('rgb(254, 242, 242)');
  });

  it('面板隐藏时 appendDelta 缓冲到内存，显示后呈现', () => {
    panel.hide();
    const id = panel.addMessage('assistant', 'streaming');
    panel.appendDelta(id, 'buffered');

    // DOM should NOT be updated yet (panel hidden)
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    const contentEl = wrapper.querySelector('[data-aa-content]') as HTMLElement;
    expect(contentEl.textContent).toBe('');

    // Show panel and trigger another delta to flush
    panel.show();
    panel.appendDelta(id, ' more');
    expect(contentEl.textContent).toBe('buffered more');
  });

  // Feature: sdk-core, Property 12: 消息气泡状态机转换
  it('Property 12 — delta 序列拼接完整性', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        (deltas) => {
          const p = makePanel();
          p.show();
          const id = p.addMessage('user', 'streaming');
          for (const d of deltas) p.appendDelta(id, d);
          const wrapper = p.getMessageListEl().lastElementChild as HTMLElement;
          const contentEl = wrapper.querySelector('[data-aa-content]') as HTMLElement;
          const ok = contentEl.textContent === deltas.join('');
          cleanup(p);
          return ok;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sdk-core, Property 13: 流式文本拼接完整性
  it('Property 13 — 内存 content 与 delta 拼接一致', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 30 }),
        (deltas) => {
          const p = makePanel();
          p.show();
          const id = p.addMessage('user', 'streaming');
          for (const d of deltas) p.appendDelta(id, d);
          p.setMessageState(id, 'done');
          const wrapper = p.getMessageListEl().lastElementChild as HTMLElement;
          const contentEl = wrapper.querySelector('[data-aa-content]') as HTMLElement;
          const ok = contentEl.textContent === deltas.join('');
          cleanup(p);
          return ok;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Task 14.3: 用户输入与发送逻辑 ────────────────────────────────────────────

describe('ChatPanel — 用户输入与发送逻辑 (14.3)', () => {
  let panel: ChatPanel;

  beforeEach(() => { panel = makePanel(); panel.show(); });
  afterEach(() => { cleanup(panel); });

  it('Enter 键触发发送', () => {
    const handler = vi.fn();
    panel.onSend(handler);
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'test message';
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(handler).toHaveBeenCalledWith('test message', undefined);
  });

  it('发送后清空输入框', () => {
    panel.onSend(() => {});
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'hello';
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(textarea.value).toBe('');
  });

  it('发送按钮点击触发发送', () => {
    const handler = vi.fn();
    panel.onSend(handler);
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'click send';
    const sendBtn = panel.getElement().querySelector('button[aria-label="发送"]') as HTMLButtonElement;
    sendBtn.click();
    expect(handler).toHaveBeenCalledWith('click send', undefined);
  });

  it('Shift+Enter 插入换行，不触发发送', () => {
    const handler = vi.fn();
    panel.onSend(handler);
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'line1';
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('空字符串不触发发送', () => {
    const handler = vi.fn();
    panel.onSend(handler);
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '';
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('setInputEnabled(false) 禁用输入框和按钮', () => {
    panel.setInputEnabled(false);
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    const sendBtn = panel.getElement().querySelector('button[aria-label="发送"]') as HTMLButtonElement;
    expect(textarea.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);
  });

  it('setInputEnabled(true) 恢复输入框和按钮', () => {
    panel.setInputEnabled(false);
    panel.setInputEnabled(true);
    const textarea = panel.getElement().querySelector('textarea') as HTMLTextAreaElement;
    const sendBtn = panel.getElement().querySelector('button[aria-label="发送"]') as HTMLButtonElement;
    expect(textarea.disabled).toBe(false);
    expect(sendBtn.disabled).toBe(false);
  });

  // Feature: sdk-core, Property 14: 空白输入不触发发送
  it('Property 14 — 纯空白字符串不触发发送', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\s+$/),
        (whitespace) => {
          const handler = vi.fn();
          const p = makePanel();
          p.show();
          p.onSend(handler);
          const textarea = p.getElement().querySelector('textarea') as HTMLTextAreaElement;
          textarea.value = whitespace;
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          const ok = handler.mock.calls.length === 0;
          cleanup(p);
          return ok;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Task 14.4: 主题配置 ───────────────────────────────────────────────────────

describe('ChatPanel — 主题配置 (14.4)', () => {
  let panel: ChatPanel;
  afterEach(() => { if (panel) cleanup(panel); });

  it('应用 primary_color 到发送按钮', () => {
    panel = makePanel({ primary_color: '#FF0000', font_family: 'Arial' });
    const sendBtn = panel.getElement().querySelector('button[aria-label="发送"]') as HTMLButtonElement;
    expect(sendBtn.style.background).toBe('rgb(255, 0, 0)');
  });

  it('应用 primary_color 到用户气泡', () => {
    panel = makePanel({ primary_color: '#FF0000', font_family: 'Arial' });
    panel.show();
    panel.addMessage('user');
    const wrapper = panel.getMessageListEl().lastElementChild as HTMLElement;
    const bubble = wrapper.firstElementChild as HTMLElement;
    expect(bubble.style.background).toBe('rgb(255, 0, 0)');
  });

  it('应用 font_family 到面板', () => {
    panel = makePanel({ primary_color: '#6366F1', font_family: 'Georgia' });
    expect(panel.getElement().style.fontFamily).toContain('Georgia');
  });

  it('应用 logo_url 到面板顶部', () => {
    panel = makePanel({ primary_color: '#6366F1', font_family: 'Arial', logo_url: 'https://example.com/logo.png' });
    const img = panel.getElement().querySelector('img[alt="Logo"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('logo.png');
  });

  it('无 logo_url 时显示默认 SVG 图标', () => {
    panel = makePanel({ primary_color: '#6366F1', font_family: 'Arial' });
    const img = panel.getElement().querySelector('img[alt="Logo"]');
    expect(img).toBeNull();
    const svgEl = panel.getElement().querySelector('svg');
    expect(svgEl).not.toBeNull();
  });
});
