// Web Assistant initialization — built on top of JS SDK
// Requirements: 10.1, 10.2, 10.3, 10.5, 11.1, 11.2, 11.3, 11.4

import { WebAASDK } from '@webaa/sdk';
import { PageScanner } from '../executor/page-scanner';
import { DOMExecutor } from '../executor/dom-executor';
import { DOMHighlight } from '../executor/dom-highlight';
import { VirtualMouse } from '../executor/virtual-mouse';
import { FloatButton } from '../ui/float-button';
import { ChatPanel } from '../ui/chat-panel';
import { StepTracker } from '../ui/step-tracker';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { TaskBorder } from '../ui/task-border';
import { RunManager } from './run-manager';
import { buildWebSkills, registerBuiltinSkillHandlers } from '../skills';
import { registerSDKEventHandlers } from '../event-handler';
import type { ChannelConfig, InitOptions } from '../types/channel';

const DEFAULT_CONFIG: ChannelConfig = {
  theme: {
    float_button: { position: 'bottom-right', color: '#6366F1' },
    chat_panel: {
      primary_color: '#6366F1',
      font_family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
  },
  permission_scope: {},
};

let _sdkInstance: WebAASDK | null = null;

export function getSDKInstance(): WebAASDK | null {
  return _sdkInstance;
}

export async function init(options: InitOptions): Promise<void> {
  const { channelKey } = options;
  const apiBase = options.apiBase ?? __AA_API_BASE__;

  // 1. Instantiate executor modules
  const pageScanner = new PageScanner();
  const domExecutor = new DOMExecutor(pageScanner);
  const domHighlight = new DOMHighlight(pageScanner);
  const virtualMouse = new VirtualMouse();
  const taskBorder = new TaskBorder();
  const runManager = new RunManager();

  // 2. Build Web-specific Skills
  const webSkills = buildWebSkills({
    pageScanner, domExecutor, domHighlight, virtualMouse, runManager,
  });

  // 3. Initialize JS SDK — handles token, config fetch, and skill registration
  const sdk = new WebAASDK();
  try {
    await sdk.init({
      channelKey,
      skills: webSkills,
      apiBase,
      user: options.user ? {
        userId: options.user.userId,
        name: options.user.name,
        avatar: options.user.avatar,
        metadata: options.user.metadata,
      } : undefined,
    });
  } catch (err) {
    console.error('[AA Web Assistant] SDK init failed:', err);
    // Show error in a minimal chat panel
    const chatPanel = new ChatPanel(DEFAULT_CONFIG.theme.chat_panel, 'bottom-right');
    const errId = chatPanel.addMessage('assistant', 'error');
    chatPanel.appendDelta(errId, `初始化失败：${err instanceof Error ? err.message : String(err)}`);
    chatPanel.setMessageState(errId, 'error');
    return;
  }

  // Store SDK instance for external access (e.g. AA.identify)
  _sdkInstance = sdk;

  // 4. Build channel config from SDK's fetched config (fallback to defaults)
  const rawConfig = sdk.channelConfig;
  const config: ChannelConfig = rawConfig
    ? {
        theme: (rawConfig.ui_theme as ChannelConfig['theme'] | undefined) ?? DEFAULT_CONFIG.theme,
        permission_scope: rawConfig.permission_scope ?? {},
      }
    : DEFAULT_CONFIG;

  // 5. Instantiate UI components with channel theme
  const chatPanel = new ChatPanel(config.theme.chat_panel, config.theme.float_button?.position ?? 'bottom-right');
  const floatButton = new FloatButton(config.theme.float_button, () => {
    if (chatPanel.getElement().style.display !== 'none') {
      chatPanel.hide();
    } else {
      chatPanel.show();
    }
  });

  const welcomeMsg = config.theme.chat_panel?.welcome_message;
  if (welcomeMsg) {
    chatPanel.addMessage('assistant', 'done', welcomeMsg);
  }

  const stepTracker = new StepTracker(chatPanel.getMessageListEl());
  const confirmDialog = new ConfirmDialog(chatPanel, config.theme.chat_panel?.primary_color ?? '#6366F1');

  // 6. Register local execute handlers for platform builtin skills
  registerBuiltinSkillHandlers({
    sdk,
    chatPanel,
    primaryColor: config.theme.chat_panel?.primary_color ?? '#6366F1',
  });

  // 7. Register AG-UI event handlers for UI updates
  registerSDKEventHandlers({
    sdk, chatPanel, stepTracker, confirmDialog, domHighlight,
    virtualMouse, pageScanner, domExecutor, runManager, floatButton, taskBorder,
  });

  // 8. ChatPanel onSend: scan page, call sdk.run() with Web context
  chatPanel.onSend((userInput: string) => {
    const { elements } = pageScanner.scan();
    chatPanel.addMessage('user', 'done', userInput);
    chatPanel.setInputEnabled(false);

    const emitter = sdk.run({
      userInput,
      context: { dom_snapshot: elements, current_url: window.location.href },
    });

    wireEmitterToUI(emitter, {
      chatPanel, stepTracker, confirmDialog, domHighlight, virtualMouse,
      pageScanner, runManager, floatButton, taskBorder, sdk,
    });
  });

  // 9. Check sessionStorage for cross-page navigation resume
  const passiveNavRaw = sessionStorage.getItem('aa_passive_nav');
  if (passiveNavRaw) {
    try {
      const passiveNav = JSON.parse(passiveNavRaw) as {
        run_id: string | null;
        tool_call_id: string;
        action: string;
      };
      sessionStorage.removeItem('aa_passive_nav');

      const { elements } = pageScanner.scan();
      chatPanel.show();

      const emitter = sdk.run({
        userInput: '',
        context: { dom_snapshot: elements, current_url: window.location.href },
        runId: passiveNav.run_id ?? undefined,
        toolResult: {
          tool_call_id: passiveNav.tool_call_id,
          result: {
            success: true, navigated: true,
            new_url: window.location.href, dom_snapshot: elements,
          },
        },
      });

      wireEmitterToUI(emitter, {
        chatPanel, stepTracker, confirmDialog, domHighlight, virtualMouse,
        pageScanner, runManager, floatButton, taskBorder, sdk,
      });
    } catch {
      sessionStorage.removeItem('aa_passive_nav');
    }
  } else if (runManager.hasTask()) {
    runManager.clear();
  }
}

// ── Wire SDK EventEmitter to UI components ──

interface WireDeps {
  chatPanel: ChatPanel;
  stepTracker: StepTracker;
  confirmDialog: ConfirmDialog;
  domHighlight: DOMHighlight;
  virtualMouse: VirtualMouse;
  pageScanner: PageScanner;
  runManager: RunManager;
  floatButton: FloatButton;
  taskBorder: TaskBorder;
  sdk: WebAASDK;
}

function wireEmitterToUI(
  emitter: { on: (event: string, handler: (...args: any[]) => void) => void },
  deps: WireDeps,
): void {
  const {
    chatPanel, stepTracker, domHighlight, virtualMouse,
    runManager, floatButton, taskBorder, sdk,
  } = deps;

  let currentMsgId: string | null = null;
  let stopped = false;
  const shownDialogMessages = new Set<string>();

  emitter.on('RunStarted', (event: any) => {
    if (event.payload?.run_id) runManager.saveRunId(event.payload.run_id);
    stopped = false;
    stepTracker.clear();
    currentMsgId = null;
    floatButton.setState('running');
    chatPanel.showStopButton();
    taskBorder.show();
    virtualMouse.show();
  });

  emitter.on('done', () => {
    domHighlight.clear();
    virtualMouse.remove();
    taskBorder.hide();
    runManager.clear();
    chatPanel.setInputEnabled(true);
    chatPanel.hideStopButton();
    floatButton.setState('closed');
  });

  emitter.on('TextMessageStart', () => {
    currentMsgId = chatPanel.addMessage('assistant', 'streaming');
  });

  emitter.on('TextMessageDelta', (event: any) => {
    if (currentMsgId === null) return;
    chatPanel.appendDelta(currentMsgId, event.payload?.delta ?? '');
  });

  emitter.on('TextMessageEnd', (event: any) => {
    if (currentMsgId !== null) {
      const msgContent = event?.payload?.content as string | undefined;
      if (msgContent && shownDialogMessages.has(msgContent)) {
        chatPanel.removeMessage(currentMsgId);
        shownDialogMessages.delete(msgContent);
      } else {
        chatPanel.setMessageState(currentMsgId, 'done');
      }
    }
  });

  emitter.on('ToolCallStart', (event: any) => {
    const payload = event.payload;
    const stepDesc = payload?.step_description as string | undefined;
    stepTracker.addStep(payload.tool_call_id, payload.tool_name, stepDesc ? { step_description: stepDesc } : undefined);
  });

  emitter.on('ToolCallEnd', (event: any) => {
    const payload = event.payload;
    stepTracker.completeStep(payload?.tool_call_id);
    if (payload?.tool_name === 'dialog_skill') {
      const result = payload?.result;
      const action = result?.action as string | undefined;
      const message = result?.message as string | undefined;
      if (message && (action === 'notify' || action === 'error')) {
        const msgId = chatPanel.addMessage('assistant', 'done', message);
        chatPanel.setMessageState(msgId, 'done');
        shownDialogMessages.add(message);
      }
    }
  });

  emitter.on('StateSnapshotEvent', (event: any) => {
    runManager.save(event.payload);
  });

  emitter.on('error', (event: any) => {
    const message = event?.payload?.message ?? event?.message ?? 'Unknown error';
    const errId = chatPanel.addMessage('assistant', 'error');
    chatPanel.appendDelta(errId, typeof message === 'string' ? message : String(message));
    chatPanel.setMessageState(errId, 'error');
    runManager.clear();
    chatPanel.setInputEnabled(true);
    chatPanel.hideStopButton();
    floatButton.setState('closed');
    taskBorder.hide();
  });

  chatPanel.onStop(async () => {
    if (stopped) return;
    stopped = true;
    sdk.disconnect();

    const runId = runManager.loadRunId();
    if (runId && sdk.accessToken) {
      try {
        await fetch(`${sdk.apiBase}/api/agent/run/${encodeURIComponent(runId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${sdk.accessToken}` },
        });
      } catch { /* ignore */ }
    }

    runManager.clear();
    domHighlight.clear();
    virtualMouse.remove();
    taskBorder.hide();
    chatPanel.setInputEnabled(true);
    chatPanel.hideStopButton();
    floatButton.setState('closed');

    const msgId = chatPanel.addMessage('assistant', 'done');
    chatPanel.appendDelta(msgId, '已停止');
    chatPanel.setMessageState(msgId, 'done');
  });
}
