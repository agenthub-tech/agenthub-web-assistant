// ChatPanel — 对话面板
// 需求：10.1、10.2、10.4、10.5、11.1、11.2、11.3、11.4、11.5、12.1、12.2、12.4、13.1、13.2、13.3、13.4、15.3、15.4、15.5

import type { ChatPanelTheme } from '../types/channel';

export type MessageState = 'pending' | 'streaming' | 'done' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state: MessageState;
}

const DEFAULT_PRIMARY_COLOR = '#6366F1';
const DEFAULT_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const DOTS_STYLE_ID = 'aa-sdk-dots-style';

function injectDotStyles(): void {
  if (document.getElementById(DOTS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DOTS_STYLE_ID;
  style.setAttribute('data-aa-sdk', 'true');
  style.textContent = `
@keyframes aa-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40%            { transform: translateY(-5px); opacity: 1; }
}
.aa-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #9CA3AF; margin: 0 2px; animation: aa-dot-bounce 1.2s ease-in-out infinite; }
.aa-dot:nth-child(2) { animation-delay: 0.2s; }
.aa-dot:nth-child(3) { animation-delay: 0.4s; }
`;
  document.head.appendChild(style);
}

const AA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 28 28" fill="none">
  <rect x="2" y="6" width="24" height="16" rx="4" fill="rgba(255,255,255,0.25)"/>
  <text x="14" y="18" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">AA</text>
</svg>`;

export class ChatPanel {
  private panelEl: HTMLElement;
  private headerEl: HTMLElement;
  private logoEl: HTMLElement;
  private messageListEl: HTMLElement;
  private inputAreaEl: HTMLElement;
  private textareaEl: HTMLTextAreaElement;
  private sendBtnEl: HTMLButtonElement;

  private stopBtnEl: HTMLButtonElement;

  private messages: Map<string, Message> = new Map();
  private messageBubbles: Map<string, HTMLElement> = new Map();
  private sendHandler: ((input: string) => void) | null = null;
  private stopHandler: (() => void) | null = null;
  private visible = false;
  private primaryColor: string;
  private fontFamily: string;

  constructor(theme?: Partial<ChatPanelTheme>, position: 'bottom-right' | 'bottom-left' = 'bottom-right') {
    this.primaryColor = theme?.primary_color ?? DEFAULT_PRIMARY_COLOR;
    this.fontFamily = theme?.font_family ?? DEFAULT_FONT_FAMILY;

    injectDotStyles();

    const hAlign = position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;';

    // Root panel
    this.panelEl = document.createElement('div');
    this.panelEl.setAttribute('data-aa-sdk', 'true');
    this.panelEl.style.cssText = `
      position: fixed;
      bottom: 80px;
      ${hAlign}
      width: 360px;
      height: 520px;
      z-index: 10000;
      display: none;
      flex-direction: column;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      overflow: hidden;
      font-family: ${this.fontFamily};
    `;

    // Header
    this.headerEl = document.createElement('div');
    this.headerEl.setAttribute('data-aa-sdk', 'true');
    this.headerEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      flex-shrink: 0;
      background: ${this.primaryColor};
    `;

    this.logoEl = document.createElement('span');
    this.logoEl.setAttribute('data-aa-sdk', 'true');
    this.logoEl.style.cssText = 'display:flex;align-items:center;flex-shrink:0;';
    this.logoEl.innerHTML = AA_LOGO_SVG;

    const titleEl = document.createElement('span');
    titleEl.setAttribute('data-aa-sdk', 'true');
    titleEl.style.cssText = `font-size:15px;font-weight:600;color:#ffffff;font-family:${this.fontFamily};`;
    titleEl.textContent = 'AA 助手';

    this.headerEl.appendChild(this.logoEl);
    this.headerEl.appendChild(titleEl);

    // Message list
    this.messageListEl = document.createElement('div');
    this.messageListEl.setAttribute('data-aa-sdk', 'true');
    this.messageListEl.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px 12px 4px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Input area
    this.inputAreaEl = document.createElement('div');
    this.inputAreaEl.setAttribute('data-aa-sdk', 'true');
    this.inputAreaEl.style.cssText = `
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid #F3F4F6;
      flex-shrink: 0;
      background: #ffffff;
    `;

    this.textareaEl = document.createElement('textarea');
    this.textareaEl.setAttribute('data-aa-sdk', 'true');
    this.textareaEl.placeholder = '输入消息…';
    this.textareaEl.rows = 1;
    this.textareaEl.style.cssText = `
      flex: 1;
      resize: none;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 14px;
      font-family: ${this.fontFamily};
      color: #111827;
      outline: none;
      line-height: 1.5;
      max-height: 120px;
      overflow-y: auto;
      background: #F9FAFB;
      transition: border-color 0.15s ease;
    `;
    this.textareaEl.addEventListener('focus', () => {
      this.textareaEl.style.borderColor = this.primaryColor;
      this.textareaEl.style.background = '#ffffff';
    });
    this.textareaEl.addEventListener('blur', () => {
      this.textareaEl.style.borderColor = '#E5E7EB';
      this.textareaEl.style.background = '#F9FAFB';
    });
    this.textareaEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.triggerSend();
      }
      // Shift+Enter: default behavior inserts newline
    });

    this.sendBtnEl = document.createElement('button');
    this.sendBtnEl.setAttribute('data-aa-sdk', 'true');
    this.sendBtnEl.setAttribute('aria-label', '发送');
    this.sendBtnEl.style.cssText = `
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: none;
      background: ${this.primaryColor};
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      transition: opacity 0.15s ease;
    `;
    this.sendBtnEl.innerHTML = `<svg data-aa-sdk="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L14 2L10 8L14 14L2 8Z" fill="white"/></svg>`;
    this.sendBtnEl.addEventListener('click', () => this.triggerSend());

    // Stop button — shown only when agent is running
    this.stopBtnEl = document.createElement('button');
    this.stopBtnEl.setAttribute('data-aa-sdk', 'true');
    this.stopBtnEl.setAttribute('aria-label', '停止');
    this.stopBtnEl.style.cssText = `
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: none;
      background: #EF4444;
      color: #ffffff;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      outline: none;
      transition: opacity 0.15s ease;
    `;
    this.stopBtnEl.innerHTML = `<svg data-aa-sdk="true" width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2" fill="white"/></svg>`;
    this.stopBtnEl.addEventListener('click', () => {
      if (this.stopHandler) this.stopHandler();
    });

    this.inputAreaEl.appendChild(this.textareaEl);
    this.inputAreaEl.appendChild(this.stopBtnEl);
    this.inputAreaEl.appendChild(this.sendBtnEl);

    // Assemble
    this.panelEl.appendChild(this.headerEl);
    this.panelEl.appendChild(this.messageListEl);
    this.panelEl.appendChild(this.inputAreaEl);

    document.body.appendChild(this.panelEl);

    // Apply logo if provided
    if (theme?.logo_url) {
      this.applyLogoUrl(theme.logo_url);
    }
  }

  getPrimaryColor(): string {
    return this.primaryColor;
  }

  // ── Visibility ──────────────────────────────────────────────────────────────

  show(): void {
    this.visible = true;
    this.panelEl.style.display = 'flex';
    // 刷新所有已 buffer 但未渲染的消息内容
    this.messages.forEach((message, id) => {
      const bubble = this.messageBubbles.get(id);
      if (!bubble) return;
      const contentEl = bubble.querySelector('[data-aa-content]') as HTMLElement | null;
      if (contentEl && message.content) {
        contentEl.textContent = message.content;
      }
    });
    this.scrollToBottom();
  }

  hide(): void {
    this.visible = false;
    this.panelEl.style.display = 'none';
  }

  // ── Send handler ─────────────────────────────────────────────────────────────

  onSend(handler: (input: string) => void): void {
    this.sendHandler = handler;
  }

  // ── Stop button ──────────────────────────────────────────────────────────────

  onStop(callback: () => void): void {
    this.stopHandler = callback;
  }

  showStopButton(): void {
    this.stopBtnEl.style.display = 'flex';
  }

  hideStopButton(): void {
    this.stopBtnEl.style.display = 'none';
  }

  addInputMessage(message: string, placeholder: string, inputType: 'text' | 'password', primaryColor: string, onSubmit: (value: string) => void): void {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-aa-sdk', 'true');
    wrapper.style.cssText = `display:flex;justify-content:flex-start;align-items:flex-end;gap:6px;`;

    const bubble = document.createElement('div');
    bubble.setAttribute('data-aa-sdk', 'true');
    bubble.style.cssText = `
      max-width: 85%;
      padding: 12px 14px;
      border-radius: 14px 14px 14px 4px;
      font-size: 14px;
      line-height: 1.55;
      background: #F3F4F6;
      color: #111827;
      font-family: ${this.fontFamily};
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    const msgEl = document.createElement('span');
    msgEl.setAttribute('data-aa-sdk', 'true');
    msgEl.textContent = message;

    const inputEl = document.createElement('input');
    inputEl.setAttribute('data-aa-sdk', 'true');
    inputEl.type = inputType;
    inputEl.placeholder = placeholder;
    inputEl.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: 7px 10px;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 13px;
      font-family: ${this.fontFamily};
      outline: none;
      background: #fff;
      color: #111827;
      transition: border-color 0.15s ease;
    `;
    inputEl.addEventListener('focus', () => { inputEl.style.borderColor = primaryColor; });
    inputEl.addEventListener('blur', () => { inputEl.style.borderColor = '#D1D5DB'; });

    const submitBtn = document.createElement('button');
    submitBtn.setAttribute('data-aa-sdk', 'true');
    submitBtn.textContent = '提交';
    submitBtn.style.cssText = `
      align-self: flex-end;
      padding: 6px 16px;
      border-radius: 6px;
      border: none;
      background: ${primaryColor};
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      outline: none;
      transition: opacity 0.15s ease;
    `;
    submitBtn.addEventListener('mouseenter', () => { submitBtn.style.opacity = '0.85'; });
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.opacity = '1'; });

    const submit = () => {
      const val = inputEl.value.trim();
      if (!val) return;
      inputEl.disabled = true;
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.4';
      submitBtn.style.cursor = 'default';
      onSubmit(val);
    };

    submitBtn.addEventListener('click', submit);
    inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') submit();
    });

    bubble.appendChild(msgEl);
    bubble.appendChild(inputEl);
    bubble.appendChild(submitBtn);
    wrapper.appendChild(bubble);

    this.messages.set(id, { id, role: 'assistant', content: message, state: 'done' });
    this.messageBubbles.set(id, wrapper);
    this.messageListEl.appendChild(wrapper);
    this.scrollToBottom();

    // 自动聚焦输入框
    setTimeout(() => inputEl.focus(), 50);
  }

  // ── Confirm message ─────────────────────────────────────────────────────────

  addConfirmMessage(message: string, primaryColor: string, onResult: (confirmed: boolean) => void): void {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-aa-sdk', 'true');
    wrapper.style.cssText = `
      display: flex;
      justify-content: flex-start;
      align-items: flex-end;
      gap: 6px;
    `;

    const bubble = document.createElement('div');
    bubble.setAttribute('data-aa-sdk', 'true');
    bubble.style.cssText = `
      max-width: 85%;
      padding: 12px 14px;
      border-radius: 14px 14px 14px 4px;
      font-size: 14px;
      line-height: 1.55;
      word-break: break-word;
      background: #F3F4F6;
      color: #111827;
      font-family: ${this.fontFamily};
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const msgEl = document.createElement('span');
    msgEl.setAttribute('data-aa-sdk', 'true');
    msgEl.textContent = message;

    const btnRow = document.createElement('div');
    btnRow.setAttribute('data-aa-sdk', 'true');
    btnRow.style.cssText = 'display:flex;gap:8px;';

    const makeBtn = (text: string, isPrimary: boolean) => {
      const btn = document.createElement('button');
      btn.setAttribute('data-aa-sdk', 'true');
      btn.textContent = text;
      btn.style.cssText = `
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        outline: none;
        border: ${isPrimary ? 'none' : '1px solid #D1D5DB'};
        background: ${isPrimary ? primaryColor : '#ffffff'};
        color: ${isPrimary ? '#ffffff' : '#374151'};
        transition: opacity 0.15s ease;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
      return btn;
    };

    const cancelBtn = makeBtn('取消', false);
    const confirmBtn = makeBtn('确认', true);

    const disableBtns = () => {
      cancelBtn.disabled = true;
      confirmBtn.disabled = true;
      cancelBtn.style.opacity = '0.4';
      confirmBtn.style.opacity = '0.4';
      cancelBtn.style.cursor = 'default';
      confirmBtn.style.cursor = 'default';
    };

    cancelBtn.addEventListener('click', () => {
      disableBtns();
      onResult(false);
    });
    confirmBtn.addEventListener('click', () => {
      disableBtns();
      onResult(true);
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    bubble.appendChild(msgEl);
    bubble.appendChild(btnRow);
    wrapper.appendChild(bubble);

    this.messages.set(id, { id, role: 'assistant', content: message, state: 'done' });
    this.messageBubbles.set(id, wrapper);
    this.messageListEl.appendChild(wrapper);
    this.scrollToBottom();
  }

  // ── Message management ───────────────────────────────────────────────────────

  addMessage(role: 'user' | 'assistant', state: MessageState = 'done', initialContent = ''): string {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const message: Message = { id, role, content: initialContent, state };
    this.messages.set(id, message);

    const bubble = this.createBubble(message);
    this.messageBubbles.set(id, bubble);
    this.messageListEl.appendChild(bubble);
    this.scrollToBottom();

    return id;
  }

  removeMessage(messageId: string): void {
    const bubble = this.messageBubbles.get(messageId);
    if (bubble) {
      bubble.remove();
      this.messageBubbles.delete(messageId);
    }
    this.messages.delete(messageId);
  }

  appendDelta(messageId: string, delta: string): void {
    const message = this.messages.get(messageId);
    if (!message) return;

    // Always buffer to memory
    message.content += delta;

    // Only update DOM if visible
    if (!this.visible) return;

    const bubble = this.messageBubbles.get(messageId);
    if (!bubble) return;

    const contentEl = bubble.querySelector('[data-aa-content]') as HTMLElement | null;
    if (contentEl) {
      // Synchronous DOM update — no rAF, satisfies ≤16ms requirement
      contentEl.textContent = message.content;
    }
    this.scrollToBottom();
  }

  setMessageState(messageId: string, state: MessageState): void {
    const message = this.messages.get(messageId);
    if (!message) return;

    message.state = state;

    const bubble = this.messageBubbles.get(messageId);
    if (!bubble) return;

    this.updateBubbleState(bubble, message);
  }

  // ── Input control ────────────────────────────────────────────────────────────

  setInputEnabled(enabled: boolean): void {
    this.textareaEl.disabled = !enabled;
    this.sendBtnEl.disabled = !enabled;
    this.sendBtnEl.style.opacity = enabled ? '1' : '0.5';
    this.sendBtnEl.style.cursor = enabled ? 'pointer' : 'not-allowed';
    this.textareaEl.style.opacity = enabled ? '1' : '0.6';
  }

  // ── Expose message list for StepTracker ─────────────────────────────────────

  getMessageListEl(): HTMLElement {
    return this.messageListEl;
  }

  // ── Expose root element (for testing / external access) ──────────────────────

  getElement(): HTMLElement {
    return this.panelEl;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private triggerSend(): void {
    const raw = this.textareaEl.value;
    if (!raw || raw.trim() === '') return;

    const text = raw;
    this.textareaEl.value = '';

    if (this.sendHandler) {
      this.sendHandler(text);
    }
  }

  private scrollToBottom(): void {
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private createBubble(message: Message): HTMLElement {
    const isUser = message.role === 'user';

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-aa-sdk', 'true');
    wrapper.style.cssText = `
      display: flex;
      justify-content: ${isUser ? 'flex-end' : 'flex-start'};
      align-items: flex-end;
      gap: 6px;
    `;

    const bubble = document.createElement('div');
    bubble.setAttribute('data-aa-sdk', 'true');
    bubble.style.cssText = `
      max-width: 78%;
      padding: 9px 13px;
      border-radius: ${isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};
      font-size: 14px;
      line-height: 1.55;
      word-break: break-word;
      white-space: pre-wrap;
      font-family: ${this.fontFamily};
      ${isUser
        ? `background: ${this.primaryColor}; color: #ffffff;`
        : 'background: #F3F4F6; color: #111827;'
      }
    `;

    if (message.state === 'pending') {
      bubble.innerHTML = this.pendingDotsHTML();
    } else {
      const contentEl = document.createElement('span');
      contentEl.setAttribute('data-aa-sdk', 'true');
      contentEl.setAttribute('data-aa-content', 'true');
      contentEl.textContent = message.content;
      bubble.appendChild(contentEl);
    }

    if (message.state === 'error') {
      bubble.style.background = '#FEF2F2';
      bubble.style.color = '#DC2626';
      bubble.style.border = '1px solid #FECACA';
    }

    wrapper.appendChild(bubble);
    return wrapper;
  }

  private updateBubbleState(wrapper: HTMLElement, message: Message): void {
    const bubble = wrapper.firstElementChild as HTMLElement | null;
    if (!bubble) return;

    if (message.state === 'streaming') {
      // Replace pending dots with content span
      bubble.innerHTML = '';
      const contentEl = document.createElement('span');
      contentEl.setAttribute('data-aa-sdk', 'true');
      contentEl.setAttribute('data-aa-content', 'true');
      contentEl.textContent = message.content;
      bubble.appendChild(contentEl);
      bubble.style.background = '#F3F4F6';
      bubble.style.color = '#111827';
      bubble.style.border = '';
    } else if (message.state === 'done') {
      const contentEl = bubble.querySelector('[data-aa-content]') as HTMLElement | null;
      if (contentEl) {
        contentEl.textContent = message.content;
      }
      bubble.style.background = '#F3F4F6';
      bubble.style.color = '#111827';
      bubble.style.border = '';
    } else if (message.state === 'error') {
      const contentEl = bubble.querySelector('[data-aa-content]') as HTMLElement | null;
      if (contentEl) {
        contentEl.textContent = message.content;
      }
      bubble.style.background = '#FEF2F2';
      bubble.style.color = '#DC2626';
      bubble.style.border = '1px solid #FECACA';
    }
  }

  private pendingDotsHTML(): string {
    return `<span data-aa-sdk="true" style="display:inline-flex;align-items:center;height:18px;">
      <span class="aa-dot" data-aa-sdk="true"></span>
      <span class="aa-dot" data-aa-sdk="true"></span>
      <span class="aa-dot" data-aa-sdk="true"></span>
    </span>`;
  }

  private applyLogoUrl(logoUrl: string): void {
    this.logoEl.innerHTML = `<img src="${logoUrl}" width="22" height="22" alt="Logo" style="border-radius:4px;object-fit:cover;" data-aa-sdk="true" />`;
  }
}
