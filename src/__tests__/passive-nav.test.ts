// Property 14: passive navigation sessionStorage round-trip
// Validates: Requirements 13.2, 13.3, 13.8
// Feature: skill-full-implementation, Property 14: passive navigation sessionStorage round-trip

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

const PASSIVE_NAV_KEY = 'aa_passive_nav';

// Simulate the beforeunload handler logic from the DOMExecuteInstruction handler
function writePassiveNav(runId: string | null, toolCallId: string, action: string): void {
  sessionStorage.setItem(PASSIVE_NAV_KEY, JSON.stringify({
    run_id: runId,
    tool_call_id: toolCallId,
    action,
  }));
}

// Simulate the init.ts passive nav resume logic
function readAndClearPassiveNav(): { run_id: string | null; tool_call_id: string; action: string } | null {
  const raw = sessionStorage.getItem(PASSIVE_NAV_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    sessionStorage.removeItem(PASSIVE_NAV_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(PASSIVE_NAV_KEY);
    return null;
  }
}

describe('Property 14: passive navigation sessionStorage round-trip', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should write and read back run_id and tool_call_id correctly for any valid inputs', () => {
    // **Validates: Requirements 13.2, 13.3, 13.8**
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),  // run_id
        fc.string({ minLength: 1, maxLength: 64 }),  // tool_call_id
        fc.constantFrom('click', 'input', 'scroll', 'clear'),  // action
        (runId, toolCallId, action) => {
          sessionStorage.clear();

          // Simulate beforeunload handler writing to sessionStorage (Req 13.2)
          writePassiveNav(runId, toolCallId, action);

          // Verify key is present after write
          expect(sessionStorage.getItem(PASSIVE_NAV_KEY)).not.toBeNull();

          // Simulate SDK init reading and clearing (Req 13.3, 13.8)
          const result = readAndClearPassiveNav();

          // Data integrity: run_id and tool_call_id must match
          expect(result).not.toBeNull();
          expect(result!.run_id).toBe(runId);
          expect(result!.tool_call_id).toBe(toolCallId);
          expect(result!.action).toBe(action);

          // Req 13.8: key must be removed after reading
          expect(sessionStorage.getItem(PASSIVE_NAV_KEY)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle null run_id (run not yet established)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),  // tool_call_id
        (toolCallId) => {
          sessionStorage.clear();

          writePassiveNav(null, toolCallId, 'click');

          const result = readAndClearPassiveNav();
          expect(result).not.toBeNull();
          expect(result!.run_id).toBeNull();
          expect(result!.tool_call_id).toBe(toolCallId);
          expect(sessionStorage.getItem(PASSIVE_NAV_KEY)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null when aa_passive_nav is not present', () => {
    sessionStorage.clear();
    const result = readAndClearPassiveNav();
    expect(result).toBeNull();
  });

  it('should clear the key even when JSON is malformed', () => {
    sessionStorage.setItem(PASSIVE_NAV_KEY, 'not-valid-json{{{');
    const result = readAndClearPassiveNav();
    expect(result).toBeNull();
    expect(sessionStorage.getItem(PASSIVE_NAV_KEY)).toBeNull();
  });
});
