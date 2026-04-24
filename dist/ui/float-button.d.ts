export interface FloatButtonConfig {
    position: 'bottom-right' | 'bottom-left';
    color: string;
    icon_url?: string;
}
export type FloatButtonState = 'open' | 'closed' | 'running';
export declare class FloatButton {
    private el;
    private iconEl;
    private config;
    private state;
    constructor(config: FloatButtonConfig, onToggle: () => void);
    private applyBaseStyles;
    private applyConfig;
    setState(state: FloatButtonState): void;
    updateConfig(config: FloatButtonConfig): void;
    getState(): FloatButtonState;
    getElement(): HTMLButtonElement;
}
