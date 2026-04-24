import type { ChatPanel } from './chat-panel';
export declare class ConfirmDialog {
    private chatPanel;
    private primaryColor;
    constructor(chatPanel: ChatPanel, primaryColor: string);
    show(message: string, _tool_call_id: string, onResult: (confirmed: boolean) => void): void;
    hide(): void;
}
