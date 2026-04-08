// Channel configuration type definitions
// Requirements: 10.3, 10.4

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

export interface InitOptions {
  channelKey: string;
  apiBase?: string;  // Override compiled-in API base URL
}
