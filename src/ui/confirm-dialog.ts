// ConfirmDialog — 在聊天面板内嵌入确认消息气泡
// 需求：18.1、18.8

import type { ChatPanel } from './chat-panel';

export class ConfirmDialog {
  private chatPanel: ChatPanel;
  private primaryColor: string;

  constructor(chatPanel: ChatPanel, primaryColor: string) {
    this.chatPanel = chatPanel;
    this.primaryColor = primaryColor;
  }

  show(message: string, _tool_call_id: string, onResult: (confirmed: boolean) => void): void {
    this.chatPanel.addConfirmMessage(message, this.primaryColor, onResult);
  }

  hide(): void {
    // 气泡嵌在消息列表里，不需要主动隐藏
  }
}
