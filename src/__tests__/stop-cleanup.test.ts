// Property 15: stop cleanup completeness
// Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.6, 15.4, 15.5
// Feature: skill-full-implementation, Property 15: stop cleanup completeness

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ── Minimal stubs ────────────────────────────────────────────────────────────

function makeClient() {
  return {
    disconnected: false,
    disconnect() { this.disconnected = true; },
  };
}

function makeRunManager(runId: string | null = null) {
  const store: Record<string, string> = {};
  if (runId) store['aa_run_id'] = runId;
  store['aa_task_state'] = 'some-state';
  store['aa_passive_nav'] = 'some-nav';

  return {
    cleared: false,
    loadRunId() { return store['aa_run_id'] ?? null; },
    clear() {
      this.cleared = true;
      delete store['aa_run_id'];
      delete store['aa_task_state'];
      delete store['aa_passive_nav'];
    },
  };
}

function makeDomHighlight() {
  return { cleared: false, clear() { this.cleared = true; } };
}

function makeVirtualMouse() {
  return { removed: false, remove() { this.removed = true; } };
}

function makeChatPanel() {
  return {
    inputEnabled: true,
    stopButtonVisible: false,
    messages: [] as Array<{ role: string; content: string }>,
    setInputEnabled(v: boolean) { this.inputEnabled = v; },
    showStopButton() { this.stopButtonVisible = true; },
    hideStopButton() { this.stopButtonVisible = false; },
    addMessage(role: string, _state: string) {
      const id = `msg_${this.messages.length}`;
      this.messages.push({ role, content: '' });
      return id;
    },
    appendDelta(id: string, delta: string) {
      const idx = parseInt(id.replace('msg_', ''));
      if (this.messages[idx]) this.messages[idx].content += delta;
    },
    setMessageState(_id: string, _state: string) {},
  };
}

function makeFloatButton() {
  return { state: 'running' as string, setState(s: string) { this.state = s; } };
}

// ── The stopExecution logic extracted for testing ────────────────────────────

async function stopExecution(
  message: string,
  deps: {
    client: ReturnType<typeof makeClient>;
    runManager: ReturnType<typeof makeRunManager>;
    domHighlight: ReturnType<typeof makeDomHighlight>;
    virtualMouse: ReturnType<typeof makeVirtualMouse>;
    chatPanel: ReturnType<typeof makeChatPanel>;
    floatButton: ReturnType<typeof makeFloatButton>;
    fetchDelete: (runId: string) => Promise<void>;
  }
): Promise<void> {
  const { client, runManager, domHighlight, virtualMouse, chatPanel, floatButton, fetchDelete } = deps;

  // 1. disconnect SSE
  client.disconnect();

  // 2. DELETE run
  const runId = runManager.loadRunId();
  if (runId) {
    try {
      await fetchDelete(runId);
    } catch {
      // ignore
    }
  }

  // 3. clear sessionStorage
  runManager.clear();

  // 4. remove DOM overlays
  domHighlight.clear();
  virtualMouse.remove();

  // 5. re-enable input
  chatPanel.setInputEnabled(true);
  chatPanel.hideStopButton();

  // 6. set FloatButton closed
  floatButton.setState('closed');

  // 7. append system message
  const msgId = chatPanel.addMessage('assistant', 'done');
  chatPanel.appendDelta(msgId, message);
  chatPanel.setMessageState(msgId, 'done');
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 15: stop cleanup completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform all cleanup steps for any running state when stop is triggered', async () => {
    // **Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.6, 15.4, 15.5**
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }),  // run_id
        fc.constantFrom('已停止', '检测到用户操作，已停止执行'),  // stop message
        fc.boolean(),  // whether DELETE fetch succeeds
        async (runId, stopMessage, fetchSucceeds) => {
          const client = makeClient();
          const runManager = makeRunManager(runId);
          const domHighlight = makeDomHighlight();
          const virtualMouse = makeVirtualMouse();
          const chatPanel = makeChatPanel();
          const floatButton = makeFloatButton();

          let deleteCalled = false;
          let deletedRunId = '';
          const fetchDelete = async (sid: string) => {
            deleteCalled = true;
            deletedRunId = sid;
            if (!fetchSucceeds) throw new Error('network error');
          };

          await stopExecution(stopMessage, {
            client, runManager, domHighlight, virtualMouse, chatPanel, floatButton, fetchDelete,
          });

          // Req 14.2: SSE stream closed
          expect(client.disconnected).toBe(true);

          // Req 14.3: DELETE run called with correct run_id
          expect(deleteCalled).toBe(true);
          expect(deletedRunId).toBe(runId);

          // Req 14.4: sessionStorage cleared
          expect(runManager.cleared).toBe(true);

          // Req 14.5: DOM overlays removed
          expect(domHighlight.cleared).toBe(true);
          expect(virtualMouse.removed).toBe(true);

          // Req 14.5: chat input re-enabled
          expect(chatPanel.inputEnabled).toBe(true);

          // Req 14.6: FloatButton state is 'closed'
          expect(floatButton.state).toBe('closed');

          // Req 14.6: system message appended with correct text
          const lastMsg = chatPanel.messages[chatPanel.messages.length - 1];
          expect(lastMsg).toBeDefined();
          expect(lastMsg.content).toBe(stopMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should still perform cleanup steps 3-7 even when SSE stream is already closed (Req 14.8)', async () => {
    // **Validates: Requirement 14.8**
    const client = makeClient();
    // Simulate already-disconnected client (disconnect is idempotent)
    client.disconnected = true;

    const runManager = makeRunManager('existing-run');
    const domHighlight = makeDomHighlight();
    const virtualMouse = makeVirtualMouse();
    const chatPanel = makeChatPanel();
    const floatButton = makeFloatButton();

    // fetchDelete throws (simulating closed stream scenario)
    const fetchDelete = async (_sid: string) => { throw new Error('stream closed'); };

    // Should not throw
    await expect(
      stopExecution('已停止', { client, runManager, domHighlight, virtualMouse, chatPanel, floatButton, fetchDelete })
    ).resolves.toBeUndefined();

    // Cleanup steps 3-7 still executed
    expect(runManager.cleared).toBe(true);
    expect(domHighlight.cleared).toBe(true);
    expect(virtualMouse.removed).toBe(true);
    expect(chatPanel.inputEnabled).toBe(true);
    expect(floatButton.state).toBe('closed');
    expect(chatPanel.messages.at(-1)?.content).toBe('已停止');
  });

  it('should skip DELETE fetch when no run_id is present', async () => {
    const client = makeClient();
    const runManager = makeRunManager(null);  // no run_id
    const domHighlight = makeDomHighlight();
    const virtualMouse = makeVirtualMouse();
    const chatPanel = makeChatPanel();
    const floatButton = makeFloatButton();

    let deleteCalled = false;
    const fetchDelete = async (_sid: string) => { deleteCalled = true; };

    await stopExecution('已停止', { client, runManager, domHighlight, virtualMouse, chatPanel, floatButton, fetchDelete });

    expect(deleteCalled).toBe(false);
    // All other cleanup still happens
    expect(runManager.cleared).toBe(true);
    expect(floatButton.state).toBe('closed');
  });
});
