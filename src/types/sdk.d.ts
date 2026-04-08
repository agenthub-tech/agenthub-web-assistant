// Type declarations for the JS SDK

declare module '@webaa/sdk' {
  import { EventEmitter } from 'events';

  export interface SkillDefinition {
    name: string;
    schema: Record<string, unknown>;
    promptInjection?: string;
    executionMode: 'sdk' | 'backend';
    execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }

  export interface InitOptions {
    channelKey: string;
    skills?: SkillDefinition[];
    apiBase?: string;
    protocolVersion?: string;
    maxRetries?: number;
    retryDelay?: number;
    heartbeatTimeout?: number;
  }

  export interface RunOptions {
    userInput: string;
    context?: Record<string, unknown>;
    sessionId?: string;
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
    run(options: RunOptions): EventEmitter;
    registerLocalSkill(name: string, execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>): void;
    disconnect(): void;
    get version(): string;
    get channelId(): string | null;
    get sessionId(): string | null;
    get accessToken(): string | null;
    get apiBase(): string;
    get channelConfig(): ChannelConfig | null;
  }
}
