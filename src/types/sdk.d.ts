// Type declarations for the JS SDK
// Keep in sync with sdks/js/src/index.ts

declare module '@webaa/sdk' {
  export interface SDKEventEmitter {
    on(event: string, handler: (...args: any[]) => void): this;
    off(event: string, handler: (...args: any[]) => void): this;
    once(event: string, handler: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
  }

  export interface SkillCachePolicy {
    enabled: boolean;
    ttl: number;
    mode: 'snapshot' | 'append' | 'none';
    invalidateOn?: string[];
  }

  export type CacheFreshness = 'fresh' | 'stale' | 'expired';

  export interface SkillDefinition {
    name: string;
    schema: Record<string, unknown>;
    promptInjection?: string;
    executionMode: 'sdk' | 'backend';
    execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
    cache?: SkillCachePolicy;
  }

  export interface UserIdentity {
    userId: string;
    name?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
  }

  export interface InitOptions {
    channelKey: string;
    skills?: SkillDefinition[];
    user?: UserIdentity;
    apiBase?: string;
    protocolVersion?: string;
    maxRetries?: number;
    retryDelay?: number;
    heartbeatTimeout?: number;
  }

  export interface RunOptions {
    userInput: string;
    context?: Record<string, unknown>;
    threadId?: string;
    runId?: string;
    toolResult?: Record<string, unknown>;
  }

  export interface AGUIEvent {
    type: string;
    payload: Record<string, unknown>;
    protocol_version: string;
    timestamp: string;
  }

  export interface ChannelConfig {
    channel_id?: string;
    name?: string;
    permission_scope?: Record<string, unknown>;
    ui_theme?: Record<string, unknown>;
  }

  export class WebAASDK {
    init(options: InitOptions): Promise<void>;
    run(options: RunOptions): SDKEventEmitter;
    identify(user: UserIdentity): Promise<void>;
    onIdentify(callback: () => void): void;
    createThread(title?: string): Promise<{ id: string }>;
    newThread(): Promise<string | null>;
    switchThread(threadId: string): Promise<Record<string, unknown>>;
    listThreads(limit?: number, offset?: number): Promise<Array<Record<string, unknown>>>;
    registerLocalSkill(name: string, execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>): void;
    disconnect(): void;
    reset(): void;
    onReset(callback: () => void): void;
    invalidateCache(eventName: string): void;
    get version(): string;
    get channelId(): string | null;
    get runId(): string | null;
    get threadId(): string | null;
    get userId(): string | null;
    get accessToken(): string | null;
    get apiBase(): string;
    get channelConfig(): ChannelConfig | null;
  }
}
