// StepTracker — 步骤展示组件
// 需求：17.1、17.2、17.3、17.4、17.5、17.6、17.7

export type StepState = 'running' | 'done';

export interface Step {
  tool_call_id: string;
  tool_name: string;
  label: string;
  state: StepState;
  startTime: number;
  endTime?: number;
}

export const TOOL_LABEL_MAP: Record<string, string> = {
  dom_skill:        '操作元素',
  navigation_skill: '页面跳转',
  wait_skill:       '等待响应',
  dialog_skill:     '用户交互',
  http_skill:       '调用接口',
  clipboard_skill:  '读写剪贴板',
  knowledge_skill:  '正在查找相关内容',
};

// 不在步骤面板显示的 skill
const HIDDEN_SKILLS = new Set(['page_skill', 'wait_skill']);

const SPINNER_SVG = `<svg data-aa-sdk="true" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation:aa-spin 0.8s linear infinite;flex-shrink:0;">
  <circle cx="7" cy="7" r="5.5" stroke="#6366F1" stroke-width="2" stroke-dasharray="20 14" stroke-linecap="round"/>
</svg>`;

const CHECK_SVG = `<svg data-aa-sdk="true" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
  <circle cx="7" cy="7" r="6" fill="#22C55E"/>
  <path d="M4 7l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SPIN_STYLE_ID = 'aa-sdk-spin-style';

function injectSpinStyles(): void {
  if (document.getElementById(SPIN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SPIN_STYLE_ID;
  style.setAttribute('data-aa-sdk', 'true');
  style.textContent = `
@keyframes aa-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;
  document.head.appendChild(style);
}

export class StepTracker {
  private container: HTMLElement;
  private steps: Step[] = [];
  // Map from tool_call_id to the step's DOM row element
  private stepEls: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    injectSpinStyles();
  }

  addStep(tool_call_id: string, tool_name: string, params?: Record<string, unknown>): void {
    if (HIDDEN_SKILLS.has(tool_name)) return;
    // 优先用后端传来的 step_description，没有时 fallback 到固定文案
    const desc = params?.step_description as string | undefined;
    const label = desc || TOOL_LABEL_MAP[tool_name] || tool_name;
    const step: Step = {
      tool_call_id,
      tool_name,
      label,
      state: 'running',
      startTime: Date.now(),
    };
    this.steps.push(step);

    const row = document.createElement('div');
    row.setAttribute('data-aa-sdk', 'true');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      font-size: 13px;
      color: #374151;
      font-family: inherit;
    `;

    const iconWrap = document.createElement('span');
    iconWrap.setAttribute('data-aa-sdk', 'true');
    iconWrap.style.cssText = 'display:flex;align-items:center;';
    iconWrap.innerHTML = SPINNER_SVG;

    const labelEl = document.createElement('span');
    labelEl.setAttribute('data-aa-sdk', 'true');
    labelEl.textContent = label;

    const timeEl = document.createElement('span');
    timeEl.setAttribute('data-aa-sdk', 'true');
    timeEl.style.cssText = 'margin-left:auto;color:#9CA3AF;font-size:12px;';

    row.appendChild(iconWrap);
    row.appendChild(labelEl);
    row.appendChild(timeEl);

    this.container.appendChild(row);
    this.stepEls.set(tool_call_id, row);
    // 自动滚动到底部
    this.container.scrollTop = this.container.scrollHeight;
  }

  completeStep(tool_call_id: string): void {
    const step = this.steps.find(s => s.tool_call_id === tool_call_id);
    if (!step) return;

    step.state = 'done';
    step.endTime = Date.now();
    const elapsed = step.endTime - step.startTime;

    const row = this.stepEls.get(tool_call_id);
    if (!row) return;

    // Update icon to checkmark
    const iconWrap = row.children[0] as HTMLElement;
    iconWrap.innerHTML = CHECK_SVG;

    // Update elapsed time
    const timeEl = row.children[2] as HTMLElement;
    timeEl.textContent = `${elapsed}ms`;
  }

  getLastRunningStep(): string | null {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (this.steps[i].state === 'running') return this.steps[i].tool_call_id;
    }
    return null;
  }

  clear(): void {
    // 只移除本轮步骤行，不清空整个容器（容器里还有消息气泡）
    this.stepEls.forEach((row) => row.remove());
    this.steps = [];
    this.stepEls.clear();
  }
}
