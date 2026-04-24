import type { ChatPanelTheme } from '../types/channel';
import type { ChartType, EChartsOption } from '../types/agui';
export type MessageState = 'pending' | 'streaming' | 'done' | 'error';
export interface MessageFile {
    name: string;
    type: string;
    objectUrl?: string;
}
export interface ChartData {
    chartType: ChartType;
    echartsOption: EChartsOption;
    availableChartTypes: ChartType[];
    echartsOptions: Record<ChartType, EChartsOption>;
}
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    state: MessageState;
    files?: MessageFile[];
    chart?: ChartData;
}
export interface ThreadItem {
    id: string;
    title: string | null;
    message_count: number;
    updated_at: string;
}
export declare class ChatPanel {
    private panelEl;
    private headerEl;
    private logoEl;
    private messageListEl;
    private inputAreaEl;
    private textareaEl;
    private sendBtnEl;
    private stopBtnEl;
    private threadListEl;
    private threadToggleBtn;
    private threadListVisible;
    private toggleThreadListHandler;
    private newThreadHandler;
    private switchThreadHandler;
    private activeThreadId;
    private messages;
    private messageBubbles;
    private chartInstances;
    private sendHandler;
    private stopHandler;
    private visible;
    private pendingFiles;
    private filePreviewEl;
    private fileInputEl;
    private uploadBtnEl;
    private primaryColor;
    private fontFamily;
    constructor(theme?: Partial<ChatPanelTheme>, position?: 'bottom-right' | 'bottom-left');
    getPrimaryColor(): string;
    show(): void;
    hide(): void;
    onSend(handler: (input: string, files?: File[]) => void): void;
    onStop(callback: () => void): void;
    showStopButton(): void;
    hideStopButton(): void;
    onNewThread(handler: () => void): void;
    onSwitchThread(handler: (threadId: string) => void): void;
    onToggleThreadList(handler: () => void): void;
    /** Show the thread list toggle button (call when user is identified). */
    enableThreadList(): void;
    /** Hide the thread list toggle button (call on user logout/reset). */
    disableThreadList(): void;
    setActiveThreadId(threadId: string | null): void;
    private toggleThreadList;
    /** Render thread list with items. Called externally after fetching threads. */
    renderThreadList(threads: ThreadItem[]): void;
    /** Show thread list and trigger data fetch */
    showThreadList(): void;
    hideThreadList(): void;
    /** Clear all messages from the panel (used when switching threads) */
    clearMessages(): void;
    addInputMessage(message: string, placeholder: string, inputType: 'text' | 'password', primaryColor: string, onSubmit: (value: string) => void): void;
    addConfirmMessage(message: string, primaryColor: string, onResult: (confirmed: boolean) => void): void;
    addMessage(role: 'user' | 'assistant', state?: MessageState, initialContent?: string, files?: File[]): string;
    removeMessage(messageId: string): void;
    appendDelta(messageId: string, delta: string): void;
    setMessageState(messageId: string, state: MessageState): void;
    setInputEnabled(enabled: boolean): void;
    getMessageListEl(): HTMLElement;
    getElement(): HTMLElement;
    private triggerSend;
    private scrollToBottom;
    private _renderFilePreview;
    private createBubble;
    private _createChartContainer;
    private _initChart;
    private _updateChartType;
    /** Add a message with chart data */
    addChartMessage(role: 'user' | 'assistant', chartData: ChartData, content?: string, state?: MessageState): string;
    private updateBubbleState;
    private pendingDotsHTML;
    private applyLogoUrl;
}
