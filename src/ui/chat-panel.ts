// ChatPanel — 对话面板
// 需求：10.1、10.2、10.4、10.5、11.1、11.2、11.3、11.4、11.5、12.1、12.2、12.4、13.1、13.2、13.3、13.4、15.3、15.4、15.5

import type { ChatPanelTheme } from '../types/channel';
import { renderMarkdown } from './markdown';

export type MessageState = 'pending' | 'streaming' | 'done' | 'error';

export interface MessageFile {
  name: string;
  type: string;       // MIME type
  objectUrl?: string;  // for image preview
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state: MessageState;
  files?: MessageFile[];
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

export interface ThreadItem {
  id: string;
  title: string | null;
  message_count: number;
  updated_at: string;
}

export class ChatPanel {
  private panelEl: HTMLElement;
  private headerEl: HTMLElement;
  private logoEl: HTMLElement;
  private messageListEl: HTMLElement;
  private inputAreaEl: HTMLElement;
  private textareaEl: HTMLTextAreaElement;
  private sendBtnEl: HTMLButtonElement;

  private stopBtnEl: HTMLButtonElement;

  // Thread list UI
  private threadListEl: HTMLElement;
  private threadToggleBtn: HTMLButtonElement;
  private threadListVisible = false;
  private toggleThreadListHandler: (() => void) | null = null;
  private newThreadHandler: (() => void) | null = null;
  private switchThreadHandler: ((threadId: string) => void) | null = null;
  private activeThreadId: string | null = null;

  private messages: Map<string, Message> = new Map();
  private messageBubbles: Map<string, HTMLElement> = new Map();
  private sendHandler: ((input: string, files?: File[]) => void) | null = null;
  private stopHandler: (() => void) | null = null;
  private visible = false;
  private pendingFiles: File[] = [];
  private filePreviewEl!: HTMLElement;
  private fileInputEl!: HTMLInputElement;
  private uploadBtnEl!: HTMLElement;
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

    // Thread list toggle button (hamburger icon)
    this.threadToggleBtn = document.createElement('button');
    this.threadToggleBtn.setAttribute('data-aa-sdk', 'true');
    this.threadToggleBtn.setAttribute('aria-label', '会话列表');
    this.threadToggleBtn.style.cssText = `
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: none;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.15s ease;
    `;
    this.threadToggleBtn.innerHTML = `<svg data-aa-sdk="true" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="2" rx="1" fill="white"/><rect x="2" y="8" width="14" height="2" rx="1" fill="white"/><rect x="2" y="13" width="14" height="2" rx="1" fill="white"/></svg>`;
    this.threadToggleBtn.addEventListener('mouseenter', () => { this.threadToggleBtn.style.background = 'rgba(255,255,255,0.15)'; });
    this.threadToggleBtn.addEventListener('mouseleave', () => { this.threadToggleBtn.style.background = 'none'; });
    this.threadToggleBtn.addEventListener('click', () => this.toggleThreadList());

    this.headerEl.appendChild(this.logoEl);
    this.headerEl.appendChild(titleEl);
    this.headerEl.appendChild(this.threadToggleBtn);

    // Thread list panel (overlay inside chat panel)
    this.threadListEl = document.createElement('div');
    this.threadListEl.setAttribute('data-aa-sdk', 'true');
    this.threadListEl.style.cssText = `
      display: none;
      position: absolute;
      top: 48px;
      left: 0;
      right: 0;
      bottom: 0;
      background: #ffffff;
      z-index: 10;
      flex-direction: column;
      overflow: hidden;
    `;

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

    // File upload button (paperclip icon)
    this.fileInputEl = document.createElement('input');
    this.fileInputEl.type = 'file';
    this.fileInputEl.multiple = true;
    this.fileInputEl.accept = 'image/*,.pdf,.txt,.csv,.doc,.docx';
    this.fileInputEl.style.display = 'none';
    this.fileInputEl.addEventListener('change', () => {
      if (this.fileInputEl.files) {
        for (let i = 0; i < this.fileInputEl.files.length; i++) {
          this.pendingFiles.push(this.fileInputEl.files[i]);
        }
        this.fileInputEl.value = '';
        this._renderFilePreview();
      }
    });

    this.uploadBtnEl = document.createElement('button');
    this.uploadBtnEl.setAttribute('data-aa-sdk', 'true');
    this.uploadBtnEl.setAttribute('aria-label', '上传文件');
    this.uploadBtnEl.style.cssText = `
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #9CA3AF;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      transition: color 0.15s ease;
    `;
    this.uploadBtnEl.innerHTML = `<svg data-aa-sdk="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`;
    this.uploadBtnEl.addEventListener('mouseenter', () => { this.uploadBtnEl.style.color = this.primaryColor; });
    this.uploadBtnEl.addEventListener('mouseleave', () => { this.uploadBtnEl.style.color = '#9CA3AF'; });
    this.uploadBtnEl.addEventListener('click', () => this.fileInputEl.click());

    // File preview area (above input)
    this.filePreviewEl = document.createElement('div');
    this.filePreviewEl.setAttribute('data-aa-sdk', 'true');
    this.filePreviewEl.style.cssText = `
      display: none;
      padding: 6px 12px;
      border-top: 1px solid #F3F4F6;
      flex-shrink: 0;
      background: #F9FAFB;
      flex-wrap: wrap;
      gap: 4px;
    `;

    this.inputAreaEl.appendChild(this.fileInputEl);
    this.inputAreaEl.appendChild(this.uploadBtnEl);
    this.inputAreaEl.appendChild(this.textareaEl);
    this.inputAreaEl.appendChild(this.stopBtnEl);
    this.inputAreaEl.appendChild(this.sendBtnEl);

    // Assemble
    this.panelEl.style.position = 'fixed';
    this.panelEl.appendChild(this.headerEl);
    this.panelEl.appendChild(this.threadListEl);
    this.panelEl.appendChild(this.messageListEl);
    this.panelEl.appendChild(this.filePreviewEl);
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

  onSend(handler: (input: string, files?: File[]) => void): void {
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

  // ── Thread list ──────────────────────────────────────────────────────────────

  onNewThread(handler: () => void): void {
    this.newThreadHandler = handler;
  }

  onSwitchThread(handler: (threadId: string) => void): void {
    this.switchThreadHandler = handler;
  }

  onToggleThreadList(handler: () => void): void {
    this.toggleThreadListHandler = handler;
  }

  /** Show the thread list toggle button (call when user is identified). */
  enableThreadList(): void {
    this.threadToggleBtn.style.display = 'flex';
  }

  /** Hide the thread list toggle button (call on user logout/reset). */
  disableThreadList(): void {
    this.threadToggleBtn.style.display = 'none';
  }

  setActiveThreadId(threadId: string | null): void {
    this.activeThreadId = threadId;
  }

  private toggleThreadList(): void {
    this.threadListVisible = !this.threadListVisible;
    this.threadListEl.style.display = this.threadListVisible ? 'flex' : 'none';
    if (this.threadListVisible && this.toggleThreadListHandler) {
      this.toggleThreadListHandler();
    }
  }

  /** Render thread list with items. Called externally after fetching threads. */
  renderThreadList(threads: ThreadItem[]): void {
    this.threadListEl.innerHTML = '';

    // Header row with "新建会话" button
    const headerRow = document.createElement('div');
    headerRow.setAttribute('data-aa-sdk', 'true');
    headerRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px 8px 14px;
      flex-shrink: 0;
    `;

    const listTitle = document.createElement('span');
    listTitle.setAttribute('data-aa-sdk', 'true');
    listTitle.style.cssText = `font-size:14px;font-weight:600;color:#111827;font-family:${this.fontFamily};`;
    listTitle.textContent = '会话列表';

    const newBtn = document.createElement('button');
    newBtn.setAttribute('data-aa-sdk', 'true');
    newBtn.setAttribute('aria-label', '新建会话');
    newBtn.style.cssText = `
      padding: 5px 12px;
      border-radius: 6px;
      border: none;
      background: ${this.primaryColor};
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      font-family: ${this.fontFamily};
      transition: opacity 0.15s ease;
    `;
    newBtn.textContent = '+ 新建会话';
    newBtn.addEventListener('mouseenter', () => { newBtn.style.opacity = '0.85'; });
    newBtn.addEventListener('mouseleave', () => { newBtn.style.opacity = '1'; });
    newBtn.addEventListener('click', () => {
      this.threadListVisible = false;
      this.threadListEl.style.display = 'none';
      if (this.newThreadHandler) this.newThreadHandler();
    });

    headerRow.appendChild(listTitle);
    headerRow.appendChild(newBtn);
    this.threadListEl.appendChild(headerRow);

    // Thread items scrollable area
    const scrollArea = document.createElement('div');
    scrollArea.setAttribute('data-aa-sdk', 'true');
    scrollArea.style.cssText = 'flex:1;overflow-y:auto;padding:0 8px 8px 8px;';

    if (threads.length === 0) {
      const empty = document.createElement('div');
      empty.setAttribute('data-aa-sdk', 'true');
      empty.style.cssText = `padding:24px 14px;text-align:center;color:#9CA3AF;font-size:13px;font-family:${this.fontFamily};`;
      empty.textContent = '暂无会话记录';
      scrollArea.appendChild(empty);
    } else {
      for (const thread of threads) {
        const isActive = thread.id === this.activeThreadId;
        const row = document.createElement('div');
        row.setAttribute('data-aa-sdk', 'true');
        row.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 12px;
          margin-bottom: 4px;
          border-radius: 8px;
          cursor: pointer;
          background: ${isActive ? this.primaryColor + '12' : '#F9FAFB'};
          border: 1px solid ${isActive ? this.primaryColor + '40' : 'transparent'};
          transition: background 0.15s ease;
          font-family: ${this.fontFamily};
        `;
        row.addEventListener('mouseenter', () => {
          if (!isActive) row.style.background = '#F3F4F6';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = isActive ? this.primaryColor + '12' : '#F9FAFB';
        });
        row.addEventListener('click', () => {
          this.threadListVisible = false;
          this.threadListEl.style.display = 'none';
          if (this.switchThreadHandler) this.switchThreadHandler(thread.id);
        });

        const titleRow = document.createElement('span');
        titleRow.setAttribute('data-aa-sdk', 'true');
        titleRow.style.cssText = `font-size:13px;color:#111827;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
        titleRow.textContent = thread.title || '新会话';

        const metaRow = document.createElement('span');
        metaRow.setAttribute('data-aa-sdk', 'true');
        metaRow.style.cssText = `font-size:11px;color:#9CA3AF;`;
        const date = new Date(thread.updated_at);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        metaRow.textContent = `${thread.message_count} 条消息 · ${dateStr}`;

        row.appendChild(titleRow);
        row.appendChild(metaRow);
        scrollArea.appendChild(row);
      }
    }

    this.threadListEl.appendChild(scrollArea);
  }

  /** Show thread list and trigger data fetch */
  showThreadList(): void {
    this.threadListVisible = true;
    this.threadListEl.style.display = 'flex';
  }

  hideThreadList(): void {
    this.threadListVisible = false;
    this.threadListEl.style.display = 'none';
  }

  /** Clear all messages from the panel (used when switching threads) */
  clearMessages(): void {
    this.messages.clear();
    this.messageBubbles.clear();
    this.messageListEl.innerHTML = '';
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

  addMessage(role: 'user' | 'assistant', state: MessageState = 'done', initialContent = '', files?: File[]): string {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const messageFiles: MessageFile[] | undefined = files?.map(f => ({
      name: f.name,
      type: f.type,
      objectUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    const message: Message = { id, role, content: initialContent, state, files: messageFiles };
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
      if (message.role === 'assistant') {
        contentEl.innerHTML = renderMarkdown(message.content);
      } else {
        contentEl.textContent = message.content;
      }
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
    if (!raw || raw.trim() === '') {
      if (this.pendingFiles.length === 0) return; // nothing to send
    }

    const text = raw || '';
    this.textareaEl.value = '';
    const files = this.pendingFiles.length > 0 ? [...this.pendingFiles] : undefined;
    this.pendingFiles = [];
    this._renderFilePreview();

    if (this.sendHandler) {
      this.sendHandler(text, files);
    }
  }

  private scrollToBottom(): void {
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private _renderFilePreview(): void {
    if (this.pendingFiles.length === 0) {
      this.filePreviewEl.style.display = 'none';
      this.filePreviewEl.innerHTML = '';
      return;
    }
    this.filePreviewEl.style.display = 'flex';
    this.filePreviewEl.innerHTML = '';
    this.pendingFiles.forEach((file, idx) => {
      const isImage = file.type.startsWith('image/');
      const chip = document.createElement('div');
      chip.setAttribute('data-aa-sdk', 'true');
      chip.style.cssText = `
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: ${isImage ? '2px' : '4px 8px'};
        background: #E5E7EB;
        border-radius: ${isImage ? '6px' : '12px'};
        font-size: 11px;
        color: #374151;
      `;

      if (isImage) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px;display:block;';
        img.onload = () => URL.revokeObjectURL(img.src);
        chip.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.textContent = file.name.toLowerCase().endsWith('.pdf') ? '📕' : '📄';
        chip.appendChild(icon);
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        nameSpan.textContent = file.name;
        chip.appendChild(nameSpan);
      }

      const closeBtn = document.createElement('span');
      closeBtn.setAttribute('data-aa-sdk', 'true');
      closeBtn.style.cssText = `
        position: absolute;
        top: -4px;
        right: -4px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #6B7280;
        color: #fff;
        font-size: 10px;
        line-height: 14px;
        text-align: center;
        cursor: pointer;
      `;
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => {
        this.pendingFiles.splice(idx, 1);
        this._renderFilePreview();
      });
      chip.appendChild(closeBtn);

      this.filePreviewEl.appendChild(chip);
    });
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
      ${isUser ? 'white-space: pre-wrap;' : ''}
      font-family: ${this.fontFamily};
      ${isUser
        ? `background: ${this.primaryColor}; color: #ffffff;`
        : 'background: #F3F4F6; color: #111827;'
      }
    `;

    if (message.state === 'pending') {
      bubble.innerHTML = this.pendingDotsHTML();
    } else {
      // File attachments (images as thumbnails, others as icon+name)
      if (message.files && message.files.length > 0) {
        const filesRow = document.createElement('div');
        filesRow.setAttribute('data-aa-sdk', 'true');
        filesRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;';

        for (const f of message.files) {
          if (f.objectUrl) {
            // Image thumbnail
            const img = document.createElement('img');
            img.src = f.objectUrl;
            img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;cursor:pointer;';
            img.addEventListener('click', () => window.open(f.objectUrl, '_blank'));
            filesRow.appendChild(img);
          } else {
            // Non-image file: icon + name
            const fileChip = document.createElement('div');
            fileChip.setAttribute('data-aa-sdk', 'true');
            const isPdf = f.name.toLowerCase().endsWith('.pdf');
            fileChip.style.cssText = `
              display:inline-flex;align-items:center;gap:4px;
              padding:4px 8px;border-radius:6px;font-size:11px;
              background:${isUser ? 'rgba(255,255,255,0.2)' : '#E5E7EB'};
              color:${isUser ? '#fff' : '#374151'};
            `;
            fileChip.innerHTML = `<span>${isPdf ? '📕' : '📄'}</span><span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>`;
            filesRow.appendChild(fileChip);
          }
        }
        bubble.appendChild(filesRow);
      }

      // Text content (always create contentEl for streaming support)
      const contentEl = document.createElement('span');
      contentEl.setAttribute('data-aa-sdk', 'true');
      contentEl.setAttribute('data-aa-content', 'true');
      if (!isUser && message.content) {
        contentEl.innerHTML = renderMarkdown(message.content);
      } else {
        contentEl.textContent = message.content;
      }
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

    const isAssistant = message.role === 'assistant';

    if (message.state === 'streaming') {
      // Replace pending dots with content span
      bubble.innerHTML = '';
      const contentEl = document.createElement('span');
      contentEl.setAttribute('data-aa-sdk', 'true');
      contentEl.setAttribute('data-aa-content', 'true');
      if (isAssistant) {
        contentEl.innerHTML = renderMarkdown(message.content);
      } else {
        contentEl.textContent = message.content;
      }
      bubble.appendChild(contentEl);
      bubble.style.background = '#F3F4F6';
      bubble.style.color = '#111827';
      bubble.style.border = '';
    } else if (message.state === 'done') {
      const contentEl = bubble.querySelector('[data-aa-content]') as HTMLElement | null;
      if (contentEl) {
        if (isAssistant) {
          contentEl.innerHTML = renderMarkdown(message.content);
        } else {
          contentEl.textContent = message.content;
        }
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
