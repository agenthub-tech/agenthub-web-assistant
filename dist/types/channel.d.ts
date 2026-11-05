export interface FloatButtonTheme {
    position: 'bottom-right' | 'bottom-left';
    color: string;
    icon_url?: string;
    background_transparent?: boolean;
    shadow_enabled?: boolean;
}
export interface ChatPanelTheme {
    title?: string | null;
    logo_url?: string;
    primary_color: string;
    background_color?: string;
    font_family?: string;
    welcome_message?: string | null;
    /** Positive px or viewport % value, e.g. '360px' or '50%'. */
    width?: string;
    /** Positive px or viewport % value, e.g. '520px' or '80%'. */
    height?: string;
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
    account?: string;
    name?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
}
export interface InitOptions {
    channelKey: string;
    apiBase?: string;
    user?: UserIdentity;
}
