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
  result?: Record<string, unknown>;
  render_hint?: 'echarts' | 'table' | 'text';
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

// Chart types
export type ChartType = 'pie' | 'line' | 'bar' | 'bar-horizontal';

export interface ChartDataItem {
  name?: string;
  x?: string;
  label?: string;
  value?: number;
  y?: number;
}

export interface ChartResult {
  success: boolean;
  chart_type: ChartType;
  echarts_option: EChartsOption;
  available_chart_types: ChartType[];
  echarts_options: Record<ChartType, EChartsOption>;
  data_summary: {
    row_count: number;
    chart_type: ChartType;
    title?: string;
  };
  error?: string;
}

// ECharts option type (simplified)
export interface EChartsOption {
  title?: {
    text?: string;
    left?: string;
    textStyle?: { fontSize?: number };
  };
  tooltip?: Record<string, unknown>;
  legend?: Record<string, unknown>;
  grid?: Record<string, unknown>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  series?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
