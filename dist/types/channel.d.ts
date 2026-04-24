export interface FloatButtonTheme {
    position: 'bottom-right' | 'bottom-left';
    color: string;
    icon_url?: string;
}
export interface ChatPanelTheme {
    logo_url?: string;
    primary_color: string;
    font_family?: string;
    welcome_message?: string | null;
}
export interface UITheme {
    float_button: FloatButtonTheme;
    chat_panel: ChatPanelTheme;
}
export interface ChannelConfig {
    theme: UITheme;
    permission_scope: Record<string, unknown>;
}
export interface UserIdentity {
    userId: string;
    name?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
}
export interface InitOptions {
    channelKey: string;
    apiBase?: string;
    user?: UserIdentity;
}
