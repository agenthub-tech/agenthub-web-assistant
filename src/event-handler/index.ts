// EventHandler — AG-UI event handler registration for Web Assistant
// Built on top of JS SDK's EventEmitter pattern
// Requirements: 10.2, 10.3, 10.4

import type { WebAASDK } from '@webaa/sdk';
import type { ChatPanel } from '../ui/chat-panel';
import type { StepTracker } from '../ui/step-tracker';
import type { ConfirmDialog } from '../ui/confirm-dialog';
import type { DOMHighlight } from '../executor/dom-highlight';
import type { VirtualMouse } from '../executor/virtual-mouse';
import type { PageScanner } from '../executor/page-scanner';
import type { DOMExecutor } from '../executor/dom-executor';
import type { RunManager } from '../core/run-manager';
import type { FloatButton } from '../ui/float-button';
import type { TaskBorder } from '../ui/task-border';

export interface SDKEventHandlerDeps {
  sdk: WebAASDK;
  chatPanel: ChatPanel;
  stepTracker: StepTracker;
  confirmDialog: ConfirmDialog;
  domHighlight: DOMHighlight;
  virtualMouse: VirtualMouse;
  pageScanner: PageScanner;
  domExecutor: DOMExecutor;
  runManager: RunManager;
  floatButton: FloatButton;
  taskBorder: TaskBorder;
}

/**
 * Register event handlers for the Web Assistant.
 * 
 * In the new architecture, the JS SDK handles:
 * - SSE connection management
 * - SkillExecuteInstruction auto-dispatch to local skill execute functions
 * - Run ID tracking and resume
 * 
 * The event handler here is a no-op placeholder since the actual event wiring
 * happens in wireEmitterToUI() within init.ts for each run() call.
 * This function is retained for backward compatibility and future extension.
 */
export function registerSDKEventHandlers(_deps: SDKEventHandlerDeps): void {
  // Event wiring is done per-run in wireEmitterToUI() within init.ts
  // This function is kept as an extension point for global SDK-level handlers
}
