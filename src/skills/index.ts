// Web-specific Skill definitions for registration with the JS SDK
// Requirements: 10.1, 10.2, 11.1, 11.2, 11.3, 11.4

import type { SkillDefinition } from 'agenthub-sdk';
import type { PageScanner } from '../executor/page-scanner';
import type { DOMExecutor } from '../executor/dom-executor';
import type { DOMHighlight } from '../executor/dom-highlight';
import type { VirtualMouse } from '../executor/virtual-mouse';
import type { RunManager } from '../core/run-manager';

// ── Skill Schemas (OpenAI function calling format) ──

const PAGE_SKILL_SCHEMA = {
  type: 'function',
  function: {
    name: 'page_skill',
    description: 'Scan the current page to get a snapshot of all interactive DOM elements. Call this before performing any DOM operations to understand the page structure.',
    parameters: {
      type: 'object',
      properties: {
        step_description: {
          type: 'string',
          description: 'Brief description of why this scan is needed',
        },
      },
      required: ['step_description'],
    },
  },
};

const DOM_SKILL_SCHEMA = {
  type: 'function',
  function: {
    name: 'dom_skill',
    description: 'Execute DOM operations on page elements. Supports click, input, scroll, and clear actions. Always reference elements by el_id from the latest page scan.',
    parameters: {
      type: 'object',
      properties: {
        step_description: {
          type: 'string',
          description: 'Brief description of this DOM operation',
        },
        action: {
          type: 'string',
          enum: ['click', 'input', 'scroll', 'clear'],
          description: 'The DOM action to perform',
        },
        el_id: {
          type: 'string',
          description: 'Element ID from page scan (e.g. el_001). Use "window" to scroll the entire page.',
        },
        value: {
          type: 'string',
          description: 'Value to input (required for input action)',
        },
        direction: {
          type: 'string',
          enum: ['up', 'down'],
          description: 'Scroll direction (for scroll action)',
        },
        distance: {
          type: 'number',
          description: 'Scroll distance in pixels (for scroll action)',
        },
      },
      required: ['step_description', 'action', 'el_id'],
    },
  },
};

const NAVIGATION_SKILL_SCHEMA = {
  type: 'function',
  function: {
    name: 'navigation_skill',
    description: 'Navigate to a specified URL. After navigation, the page must be re-scanned.',
    parameters: {
      type: 'object',
      properties: {
        step_description: {
          type: 'string',
          description: 'Brief description of why this navigation is needed',
        },
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['step_description', 'url'],
    },
  },
};

const CLIPBOARD_SKILL_SCHEMA = {
  type: 'function',
  function: {
    name: 'clipboard_skill',
    description: 'Read from or write to the system clipboard.',
    parameters: {
      type: 'object',
      properties: {
        step_description: {
          type: 'string',
          description: 'Brief description of this clipboard operation',
        },
        action: {
          type: 'string',
          enum: ['read', 'write'],
          description: 'Clipboard action',
        },
        content: {
          type: 'string',
          description: 'Content to write (required for write action)',
        },
      },
      required: ['step_description', 'action'],
    },
  },
};

// ── Prompt Injections (Req 11.1, 11.2, 11.3, 11.4) ──

const PAGE_SKILL_PROMPT = `- 每次操作前必须先调用 page_skill 确认当前页面状态
- 不确定目标元素时，优先用 page_skill 扫描，不要盲目操作
- 表格内的元素会携带 table 字段（row/col/header），用 header 匹配列名，用 row 定位数据行
- 表头元素（role: "columnheader"）不可编辑，要操作数据请使用对应行的元素`;

const DOM_SKILL_PROMPT = `- 操作元素时只使用 el_id 引用，不要自行构造 CSS selector
- 执行 DOM 操作前确保目标元素在最新的页面快照中存在
- 滚动页面查看更多内容时，使用 dom_skill 的 scroll action，el_id 传 "window"，direction 传 "down" 或 "up"
- 操作表格时，根据 table.header 匹配列名，根据 table.row 定位行，不要点击表头（role: "columnheader"）
- 元素的 events 字段列出了实际绑定的事件（如 click、change），用它判断元素的真实交互方式
- 选择表格行时，对比 table-row 和行内 radio/checkbox 的 events，哪个有 click 事件就点哪个`;

const NAVIGATION_SKILL_PROMPT = `- 页面跳转后必须重新调用 page_skill 扫描页面，不能复用旧的元素信息`;

// ── Executor Dependencies ──

export interface SkillExecutorDeps {
  pageScanner: PageScanner;
  domExecutor: DOMExecutor;
  domHighlight: DOMHighlight;
  virtualMouse: VirtualMouse;
  runManager: RunManager;
}

// ── Build Skill Definitions ──
// Only skills whose schemas are NOT provided by the backend are registered here.
// wait_skill, dialog_skill, http_skill are platform builtins — their schemas
// come from the backend. We only provide local execute handlers for them
// via registerBuiltinSkillHandlers().

export function buildWebSkills(deps: SkillExecutorDeps): SkillDefinition[] {
  const { pageScanner, domExecutor, domHighlight, virtualMouse, runManager } = deps;

  return [
    // 1. PageSkill
    {
      name: 'page_skill',
      schema: PAGE_SKILL_SCHEMA,
      promptInjection: PAGE_SKILL_PROMPT,
      executionMode: 'sdk',
      cache: { enabled: true, ttl: 30000, mode: 'snapshot', invalidateOn: ['urlchange', 'dom:mutation'] },
      execute: async (_params) => {
        const { elements, truncated } = pageScanner.scan();
        return { dom_snapshot: elements, truncated };
      },
    },

    // 2. DOMSkill
    {
      name: 'dom_skill',
      schema: DOM_SKILL_SCHEMA,
      promptInjection: DOM_SKILL_PROMPT,
      executionMode: 'sdk',
      cache: { enabled: false, ttl: 0, mode: 'none' },
      execute: async (params) => {
        const action = params.action as string;
        const el_id = params.el_id as string;
        const value = params.value as string | undefined;
        const direction = params.direction as string | undefined;
        const distance = params.distance as number | undefined;

        // Show highlight and virtual mouse before executing (skip for window scroll)
        if (el_id !== 'window') {
          domHighlight.show(el_id, []);
          const { elements } = pageScanner.scan();
          const element = elements.find((e) => e.id === el_id);
          if (element) {
            const targetEl = document.querySelector(element.selector);
            if (targetEl) {
              const rect = targetEl.getBoundingClientRect();
              virtualMouse.moveTo(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
          }

          // Small delay for visual feedback
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Check for passive navigation (beforeunload)
        const beforeUrl = window.location.href;
        let beforeunloadFired = false;

        const beforeunloadHandler = () => {
          beforeunloadFired = true;
          const runId = runManager.loadRunId();
          sessionStorage.setItem('aa_passive_nav', JSON.stringify({
            run_id: runId,
            tool_call_id: (params as any)._tool_call_id ?? '',
            action,
          }));
        };
        window.addEventListener('beforeunload', beforeunloadHandler, { once: true });

        let result;
        if (action === 'click') {
          result = domExecutor.click(el_id);
        } else if (action === 'input') {
          result = domExecutor.input(el_id, value ?? '');
        } else if (action === 'scroll') {
          result = domExecutor.scroll(el_id, direction ?? 'down', distance ?? 300);
        } else if (action === 'clear') {
          result = domExecutor.clear(el_id);
        } else {
          result = { action, el_id, success: false, error: `Unknown action: ${action}` };
        }

        // Wait briefly to detect navigation
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (beforeunloadFired) {
          return { success: true, navigated: true };
        }

        window.removeEventListener('beforeunload', beforeunloadHandler);
        domHighlight.clear();

        const currentUrl = window.location.href;
        if (currentUrl !== beforeUrl) {
          const { elements: newElements } = pageScanner.scan();
          return { ...result, navigated: true, new_url: currentUrl, dom_snapshot: newElements };
        }

        return { ...result, navigated: false };
      },
    },

    // 3. NavigationSkill
    {
      name: 'navigation_skill',
      schema: NAVIGATION_SKILL_SCHEMA,
      promptInjection: NAVIGATION_SKILL_PROMPT,
      executionMode: 'sdk',
      cache: { enabled: false, ttl: 0, mode: 'none' },
      execute: async (params) => {
        const url = params.url as string;

        const runId = runManager.loadRunId();
        sessionStorage.setItem('aa_passive_nav', JSON.stringify({
          run_id: runId,
          tool_call_id: (params as any)._tool_call_id ?? '',
          action: 'navigate',
        }));

        window.location.href = url;
        return { success: true, navigated: true, url };
      },
    },

    // 4. ClipboardSkill
    {
      name: 'clipboard_skill',
      schema: CLIPBOARD_SKILL_SCHEMA,
      executionMode: 'sdk',
      cache: { enabled: true, ttl: 0, mode: 'append' },
      execute: async (params) => {
        const action = params.action as string;
        const content = params.content as string | undefined;

        if (!navigator.clipboard) {
          return { success: false, error: 'Clipboard API not available or permission denied' };
        }

        try {
          if (action === 'read') {
            const text = await navigator.clipboard.readText();
            return { success: true, content: text };
          } else if (action === 'write') {
            await navigator.clipboard.writeText(content ?? '');
            return { success: true };
          }
          return { success: false, error: `Unknown clipboard action: ${action}` };
        } catch {
          return { success: false, error: 'Clipboard API not available or permission denied' };
        }
      },
    },
  ];
}

// ── Local execute handlers for platform builtin skills (execution_mode: "sdk") ──
// These skills have their schemas provided by the backend, but execute on the SDK side.
// Call registerBuiltinSkillHandlers() after sdk.init() to register them.

export interface BuiltinSkillHandlerDeps {
  sdk: { registerLocalSkill: (name: string, execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>) => void };
  chatPanel: { addConfirmMessage: (message: string, primaryColor: string, onResult: (confirmed: boolean) => void) => void; addInputMessage: (message: string, placeholder: string, inputType: 'text' | 'password', primaryColor: string, onSubmit: (value: string) => void) => void };
  primaryColor: string;
}

export function registerBuiltinSkillHandlers(deps: BuiltinSkillHandlerDeps): void {
  const { sdk, chatPanel, primaryColor } = deps;

  // WaitSkill — wait for DOM element visibility or a duration
  sdk.registerLocalSkill('wait_skill', async (params) => {
    const condition = params.condition as string;
    const selector = params.selector as string | undefined;
    const timeout_ms = (params.timeout_ms as number) ?? 5000;

    if (condition === 'duration') {
      await new Promise((resolve) => setTimeout(resolve, timeout_ms));
      return { success: true, condition };
    }

    if (!selector) {
      return { success: false, error: 'selector is required for element_visible/element_hidden condition' };
    }

    return new Promise<Record<string, unknown>>((resolve) => {
      const POLL_INTERVAL = 200;

      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        resolve({ success: false, error: `Wait timeout after ${timeout_ms}ms` });
      }, timeout_ms);

      const intervalId = setInterval(() => {
        const el = document.querySelector(selector);
        let conditionMet = false;

        if (condition === 'element_visible') {
          if (el) {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            conditionMet = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          }
        } else if (condition === 'element_hidden') {
          if (!el) {
            conditionMet = true;
          } else {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            conditionMet = !(style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0);
          }
        }

        if (conditionMet) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          resolve({ success: true, condition });
        }
      }, POLL_INTERVAL);
    });
  });

  // DialogSkill — show confirmation/input/notification dialogs
  sdk.registerLocalSkill('dialog_skill', async (params) => {
    const action = params.action as string;
    const message = params.message as string;

    if (action === 'confirm') {
      return new Promise<Record<string, unknown>>((resolve) => {
        chatPanel.addConfirmMessage(message, primaryColor, (confirmed) => {
          resolve({ action: 'confirm', message, confirmed });
        });
      });
    } else if (action === 'input') {
      const placeholder = (params.placeholder as string) ?? '';
      const inputType = (params.input_type as 'text' | 'password') ?? 'text';
      return new Promise<Record<string, unknown>>((resolve) => {
        chatPanel.addInputMessage(message, placeholder, inputType, primaryColor, (value) => {
          resolve({ action: 'input', message, value });
        });
      });
    } else if (action === 'notify') {
      return { action: 'notify', message, success: true };
    } else if (action === 'error') {
      return { action: 'error', message, error_shown: true };
    }

    return { success: false, error: `Unknown action: ${action}` };
  });

  // HttpSkill — make HTTP requests from the browser
  sdk.registerLocalSkill('http_skill', async (params) => {
    const method = params.method as string;
    const url = params.url as string;
    const headers = (params.headers ?? {}) as Record<string, string>;
    const body = params.body as string | undefined;

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
      };
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();

      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      return {
        success: response.ok,
        status: response.status,
        data: responseData,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

// Export schemas for testing
export {
  PAGE_SKILL_SCHEMA,
  DOM_SKILL_SCHEMA,
  NAVIGATION_SKILL_SCHEMA,
  CLIPBOARD_SKILL_SCHEMA,
  PAGE_SKILL_PROMPT,
  DOM_SKILL_PROMPT,
  NAVIGATION_SKILL_PROMPT,
};
