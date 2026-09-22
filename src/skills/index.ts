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
    description:
      'Scan the current page. Three modes: (1) Without block_id or query: returns the page structure overview — page_outline, regions, and content block summaries. (2) With query: searches all page elements by keyword (matches text, label, placeholder, value, selector) and returns matching elements directly — use this to find specific elements without drilling through regions. (3) With block_id: returns details for that block — table_001 for full table rows, chart_001 for chart data, text_001 for full text, region_001 for interactive elements in that region, el_xxxx for full element details.',
    parameters: {
      type: 'object',
      properties: {
        step_description: {
          type: 'string',
          description: 'Brief description of why this scan is needed',
        },
        query: {
          type: 'string',
          description:
            'Optional. Search keyword to find matching elements directly (e.g. "修改", "4月金额", "xxx", "填报人"). Matches against element text, label, placeholder, value, and selector. Returns matching elements with their el_id, type, text, and context.',
        },
        block_id: {
          type: 'string',
          description:
            'Optional. A block id from a previous scan (table_001, chart_001, text_001, region_001, el_xxxx). Returns details for that block instead of the overview.',
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
          description: 'Element ID from page scan (e.g. el_a3f2). Use "window" to scroll the entire page.',
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
- 三种使用方式：
  1. 搜索（query="关键词"）：直达相关元素——知道目标是什么时优先用搜索（如 query="修改"、query="xxx"、query="填报人"），支持多关键词空格分隔（AND 语义）
  2. 总览（不带参数）：看 page_outline（页面模块结构）、regions（页面区域划分）、data_tables/charts/text_blocks（内容块摘要）——不了解页面结构时用
  3. 深入（block_id=region_001/el_xxxx/table_001/chart_001/text_001）：查看区域元素列表、元素完整内容、表格全部行、图表数据、文本全文
- 工作流建议：先搜索找目标元素 → 找不到再总览看结构 → 深入区域/元素确认细节 → 执行操作
- 需要读取页面数据时优先用摘要和 block_id，不要通过点击编辑按钮或滚动去寻找内容
- 表格内的元素会携带 table 字段（row/col/header），用 header 匹配列名，用 row 定位数据行
- 表头元素（role: "columnheader"）不可编辑，要操作数据请使用对应行的元素
- el_id 是稳定标识（基于元素 selector 的 hash），同一元素多次扫描 id 不变`;

const DOM_SKILL_PROMPT = `- 操作元素时只使用 el_id 引用，不要自行构造 CSS selector
- 执行 DOM 操作前确保目标元素在最新的页面快照中存在
- 滚动页面查看更多内容时，使用 dom_skill 的 scroll action，el_id 传 "window"，direction 传 "down" 或 "up"
- 操作表格时，根据 table.header 匹配列名，根据 table.row 定位行，不要点击表头（role: "columnheader"）
- 元素的 events 字段列出了实际绑定的事件（如 click、change），用它判断元素的真实交互方式
- 选择表格行时，对比 table-row 和行内 radio/checkbox 的 events，哪个有 click 事件就点哪个
- 点击后如果没反应，先调 page_skill 重新扫描确认页面状态变化，不要盲目重试
- 不确定元素怎么交互时，先用 page_skill(block_id=el_xxxx) 查看元素的完整内容（outerHTML、事件、计算样式），再决定怎么操作`;

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
      execute: async (params) => {
        // 搜索模式：query 直达相关元素
        const query = typeof params.query === 'string' ? params.query.trim() : '';
        if (query) {
          return pageScanner.searchElements(query);
        }
        // 深入查看模式：block_id
        const blockId = typeof params.block_id === 'string' ? params.block_id.trim() : '';
        if (blockId) {
          const detail = pageScanner.getBlockDetail(blockId);
          if (!detail) {
            return {
              error: `Block '${blockId}' not found in the current page. The page may have changed — run an overview scan (page_skill without block_id) first, then use a block id from data_tables / charts / text_blocks.`,
            };
          }
          return detail;
        }
        // 总览模式：只返回结构
        const { regions, page_outline, data_tables, charts, text_blocks } = pageScanner.scan();
        return { regions, page_outline, data_tables, charts, text_blocks };
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
//
// NOTE: dialog_skill is handled by SDK core with setDialogHandler(), don't register here.

export interface BuiltinSkillHandlerDeps {
  sdk: { registerLocalSkill: (name: string, execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>) => void };
}

export function registerBuiltinSkillHandlers(deps: BuiltinSkillHandlerDeps): void {
  const { sdk } = deps;

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
