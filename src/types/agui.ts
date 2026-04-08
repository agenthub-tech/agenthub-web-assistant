// AG-UI event type definitions — simplified for general platform
// Requirements: 3.3, 13.1

import type { DOMElement } from './dom';

// Simplified event types — Web-specific events removed, replaced by SkillExecuteInstruction
export type AGUIEventType =
  | 'RunStarted'
  | 'RunFinished'
  | 'TextMessageStart'
  | 'TextMessageDelta'
  | 'TextMessageEnd'
  | 'ToolCallStart'
  | 'ToolCallDelta'
  | 'ToolCallEnd'
  | 'SkillExecuteInstruction'
  | 'StateSnapshotEvent'
  | 'Error';

export interface AGUIEvent {
  type: AGUIEventType;
  payload: Record<string, unknown>;
  protocol_version: string;
  timestamp: string;
}

// Payload type definitions

export interface TextMessageDeltaPayload {
  message_id: string;
  delta: string;
}

export interface TextMessageEndPayload {
  message_id: string;
  full_text: string;
}

export interface ToolCallStartPayload {
  tool_call_id: string;
  tool_name: string;
}

export interface ToolCallEndPayload {
  tool_call_id: string;
  tool_name: string;
}

export interface StateSnapshotPayload {
  [key: string]: unknown;
}

export interface SkillExecuteInstructionPayload {
  tool_call_id: string;
  skill_name: string;
  params: Record<string, unknown>;
}

export interface ErrorPayload {
  message: string;
}

export interface RunStartedPayload {
  run_id?: string;
}

// ToolResult — generic format for SDK tool results
export interface ToolResult {
  tool_call_id: string;
  result: Record<string, unknown>;
}
