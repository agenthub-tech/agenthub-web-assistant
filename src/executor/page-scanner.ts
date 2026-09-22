// PageScanner — DOM 快照提取
// 需求：4.1、4.2、4.3、4.4、4.5、4.6、4.7、4.8、5.1、5.2

import type { DOMElement, ScanResult, PageOutlineItem, DataTableSummary, ChartSummary, TextBlockSummary, RegionSummary } from '../types/dom';

const SELECTORS = [
  'button',
  'input',
  'textarea',
  'select',
  // All <a> tags, not just a[href] — component libraries (Ant Design Button
  // type="link", Typography.Link) render action links as <a> without href.
  'a',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[onclick]',
  '[tabindex]',
];

const MAX_ELEMENTS = 200;

// Data-table extraction budgets. Tables are read-only content, discovered as
// compact summaries first; full content is fetched on demand (progressive
// discovery) to keep the page_skill overview payload small.
const MAX_TABLES = 12;
const MAX_DETAIL_ROWS = 200;
const MAX_DETAIL_CHARS = 20000;
const PREVIEW_ROWS = 2;

interface DataTableData {
  table: Element;
  title: string;
  headers: string[];
  rows: string[][];
}

/**
 * Compute per-column header labels for a table with multi-row headers,
 * correctly handling rowspan/colspan (e.g. "累计" group over "实际/完成率/同比").
 */
function computeHeaderLabels(table: Element): string[] {
  const thead = table.querySelector('thead');
  if (!thead) return [];
  const rows = Array.from(thead.querySelectorAll('tr'));
  if (rows.length === 0) return [];

  // Occupancy grid: taken[r][c] marks a cell slot filled by rowspan/colspan.
  const taken: boolean[][] = [];
  const labels: (string | undefined)[][] = [];
  const ensureRow = (r: number) => {
    while (taken.length <= r) taken.push([]);
    while (labels.length <= r) labels.push([]);
  };

  rows.forEach((tr, r) => {
    ensureRow(r);
    let c = 0;
    Array.from(tr.children).forEach((cell) => {
      while (taken[r][c]) c++;
      const th = cell as HTMLTableCellElement;
      const cs = th.colSpan || 1;
      const rs = th.rowSpan || 1;
      const text = th.textContent?.trim() ?? '';
      for (let i = 0; i < rs; i++) {
        ensureRow(r + i);
        for (let j = 0; j < cs; j++) {
          taken[r + i][c + j] = true;
          if (i === 0 && j === 0) {
            labels[r + i][c + j] = text;
          }
        }
      }
      c += cs;
    });
  });

  const colCount = taken.reduce((m, r) => Math.max(m, r.length), 0);
  const result: string[] = [];
  for (let c = 0; c < colCount; c++) {
    const parts: string[] = [];
    for (let r = 0; r < rows.length; r++) {
      const v = labels[r]?.[c];
      if (v && !parts.includes(v)) parts.push(v);
    }
    result.push(parts.join('/'));
  }
  return result;
}

/**
 * Find a human title for a table: nearest heading in the closest section-ish
 * ancestor (panel/card), else <caption>, else empty.
 */
function findTableTitle(table: Element): string {
  const caption = table.querySelector('caption')?.textContent?.trim();
  if (caption) return caption;

  const section = table.closest(
    'section, article, [class*="panel"], [class*="card"], [class*="Panel"], [class*="module"]'
  );
  if (section) {
    const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
    const text = heading?.textContent?.trim();
    if (text) return text.slice(0, 80);
  }

  // Fall back to the nearest preceding heading in document order.
  let node: Element | null = table;
  while (node) {
    let sib: Element | null = node.previousElementSibling;
    while (sib) {
      const h = sib.matches('h1,h2,h3,h4,h5,h6')
        ? sib
        : sib.querySelector('h1, h2, h3, h4, h5, h6');
      if (h) return (h.textContent?.trim() ?? '').slice(0, 80);
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return '';
}

/**
 * Collect all plain data tables on the page (any framework, not just Ant
 * Design). Below-fold tables are included — only truly hidden ones are
 * skipped. Returns structured data (not text) so callers can build either
 * compact summaries or full detail views.
 */
function collectDataTableData(): DataTableData[] {
  const tables = Array.from(document.querySelectorAll('table'));
  const result: DataTableData[] = [];

  for (const table of tables) {
    if (result.length >= MAX_TABLES) break;
    if (isSDKElement(table)) continue;

    try {
      const style = window.getComputedStyle(table);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = table.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
    } catch {
      continue;
    }

    // Skip pure layout tables with no body data (e.g. calendar pickers).
    const bodyRows = Array.from(table.querySelectorAll('tbody > tr')).filter(
      (tr) =>
        !tr.classList.contains('ant-table-measure-row') &&
        tr.getAttribute('aria-hidden') !== 'true' &&
        (tr.textContent?.trim() ?? '').length > 0
    );
    if (bodyRows.length === 0) continue;

    const rows = bodyRows
      .map((tr) =>
        Array.from(tr.children).map(
          (td) => (td.textContent ?? '').trim().replace(/\s+/g, ' ')
        )
      )
      .filter((cells) => cells.some((c) => c.length > 0));

    if (rows.length === 0) continue;

    result.push({
      table,
      title: findTableTitle(table),
      headers: computeHeaderLabels(table),
      rows,
    });
  }

  return result;
}

/**
 * Generalized nearest-title lookup used by tables, charts and text blocks.
 */
function findNearestTitle(el: Element): string {
  const section = el.closest(
    'section, article, [class*="panel"], [class*="card"], [class*="Panel"], [class*="module"]'
  );
  if (section) {
    const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
    const text = heading?.textContent?.trim();
    if (text) return text.slice(0, 80);
  }

  let node: Element | null = el;
  while (node) {
    let sib: Element | null = node.previousElementSibling;
    while (sib) {
      const h = sib.matches('h1,h2,h3,h4,h5,h6')
        ? sib
        : sib.querySelector('h1, h2, h3, h4, h5, h6');
      if (h) return (h.textContent?.trim() ?? '').slice(0, 80);
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return '';
}

interface ChartData {
  el: Element;
  title: string;
  option: Record<string, unknown> | null;
  series: Array<Record<string, unknown>>;
}

/**
 * Detect rendered ECharts instances on the page. Their data lives in JS
 * (echarts option), not in the DOM — extract it via the global registry
 * when reachable (pages that expose window.echarts).
 */
function collectChartData(): ChartData[] {
  const els = Array.from(document.querySelectorAll('[_echarts_instance_]'));
  const result: ChartData[] = [];

  for (const el of els) {
    if (result.length >= MAX_TABLES) break;
    if (isSDKElement(el)) continue;

    let option: Record<string, unknown> | null = null;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const echarts = (window as unknown as { echarts?: { getInstanceByDom?: (e: Element) => { getOption?: () => Record<string, unknown> } | undefined } }).echarts;
      if (echarts?.getInstanceByDom) {
        option = echarts.getInstanceByDom(el)?.getOption?.() ?? null;
      }
    } catch {
      // option stays null — chart marked unreadable below
    }

    const titleOpt = (option as { title?: { text?: string } } | null)?.title?.text;
    const title =
      (typeof titleOpt === 'string' && titleOpt) ||
      el.getAttribute('aria-label') ||
      el.closest('[aria-label]')?.getAttribute('aria-label') ||
      findNearestTitle(el);

    const series = Array.isArray(option?.series)
      ? (option!.series as Array<Record<string, unknown>>)
      : [];

    result.push({ el, title: title || '', option, series });
  }

  return result;
}

interface TextBlockData {
  el: Element;
  title: string;
  own_text: string;  // text with tables and chart containers stripped
}

/** Candidate containers that usually hold human-readable content. */
const TEXT_BLOCK_SELECTOR =
  'main, article, section, [class*="md"], [class*="body"], [class*="content"], ' +
  '[class*="summary"], [class*="insight"], [class*="report"], [class*="metric"], ' +
  '[class*="card"], [class*="panel"], pre, blockquote';

const MAX_TEXT_BLOCKS = 20;
const MIN_TEXT_BLOCK_CHARS = 60;

/**
 * Collect significant read-only text blocks (summaries, insight sections,
 * KPI cards, markdown bodies). Only "leaf" containers are kept — when one
 * candidate contains another, the more specific inner one wins, so the
 * same text never appears twice.
 */
function collectTextBlocks(): TextBlockData[] {
  const candidates = Array.from(document.querySelectorAll(TEXT_BLOCK_SELECTOR));
  const kept: TextBlockData[] = [];

  for (const el of candidates) {
    if (kept.length >= MAX_TEXT_BLOCKS * 3) break; // coarse pre-filter, dedupe below
    if (isSDKElement(el)) continue;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
    } catch {
      continue;
    }

    // "Own text": clone and strip tables / chart containers — those are
    // discoverable separately, so they shouldn't pollute a text block.
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('table, [_echarts_instance_]').forEach((n) => n.remove());
    const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < MIN_TEXT_BLOCK_CHARS) continue;

    kept.push({ el, title: findNearestTitle(el), own_text: text });
  }

  // Nested-dedupe: if A contains B, keep B (more specific).
  return kept
    .filter((a) => !kept.some((b) => b !== a && a.el.contains(b.el)))
    .slice(0, MAX_TEXT_BLOCKS);
}

/**
 * Collect the page module structure: every visible heading (h1-h6), in
 * document order, excluding SDK-injected UI. Gives the agent a complete
 * map of page sections at a glance.
 */
function extractPageOutline(): PageOutlineItem[] {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const outline: PageOutlineItem[] = [];
  headings.forEach((h) => {
    if (outline.length >= 40) return;
    if (isSDKElement(h)) return;
    const text = h.textContent?.trim().replace(/\s+/g, ' ') ?? '';
    if (!text) return;
    try {
      const style = window.getComputedStyle(h);
      if (style.display === 'none' || style.visibility === 'hidden') return;
    } catch {
      return;
    }
    outline.push({ level: parseInt(h.tagName[1], 10), text: text.slice(0, 60) });
  });
  return outline;
}

function joinRow(cells: string[]): string {
  return cells.join(' | ');
}

// ── 页面区域划分 ─────────────────────────────────────────────────────────────

/** 区域容器选择器：按语义优先级排列 */
const REGION_CONTAINERS: Array<{ selector: string; type: string }> = [
  { selector: 'dialog, [role="dialog"], .ant-modal, .el-dialog', type: 'dialog' },
  { selector: '.ant-tabs, .el-tabs, [role="tablist"]', type: 'tabs' },
  { selector: 'form, .ant-form, .el-form', type: 'form' },
  { selector: 'table, .ant-table, .el-table', type: 'table' },
  { selector: 'nav, [role="navigation"], .ant-menu, .el-menu', type: 'nav' },
  { selector: 'main, article, [role="main"]', type: 'content' },
  { selector: 'section, .ant-card, .el-card, [class*="panel"]', type: 'content' },
];

/** 区域容器元素引用（extractRegions 和 getRegionElements 共享） */
const _regionContainerMap = new Map<string, Element>();

/**
 * 将页面划分为若干语义区域，返回每个区域的摘要。
 * 模型按需深入查看某个区域的交互元素（渐进式披露）。
 */
function extractRegions(elements: DOMElement[]): RegionSummary[] {
  const regions: RegionSummary[] = [];
  const assigned = new Set<string>();
  _regionContainerMap.clear();

  for (const { selector, type } of REGION_CONTAINERS) {
    const containers = document.querySelectorAll(selector);
    for (const container of Array.from(containers)) {
      if (isSDKElement(container)) continue;

      // 跳过已被更大区域包含的容器（用容器元素引用检查，不是 id 替换）
      let dominated = false;
      for (const [, existingContainer] of _regionContainerMap) {
        if (existingContainer !== container && existingContainer.contains(container)) {
          dominated = true;
          break;
        }
      }
      if (dominated) continue;

      // 找到该区域内的交互元素
      const regionElements = elements.filter((el) => {
        if (assigned.has(el.selector)) return false;
        const domEl = document.querySelector(el.selector);
        return domEl && container.contains(domEl);
      });

      if (regionElements.length === 0) continue;

      regionElements.forEach((el) => assigned.add(el.selector));

      // 区域可见性
      let visible = true;
      try {
        const style = window.getComputedStyle(container);
        visible = style.display !== 'none' && style.visibility !== 'hidden';
      } catch { /* ignore */ }

      // 区域名称
      const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .ant-card-head-title, .el-card__header');
      const name = heading?.textContent?.trim().slice(0, 40)
        || regionElements[0]?.text?.slice(0, 40)
        || type;

      // 操作类型（修改/删除/编辑等）
      const actionSet = new Set<string>();
      for (const el of regionElements) {
        if (el.text && isActionText(el.text)) actionSet.add(el.text);
      }

      // 预览
      const preview = regionElements
        .slice(0, 6)
        .map((el) => el.text || el.label || el.type)
        .filter(Boolean)
        .join(' | ')
        .slice(0, 120);

      const regionId = `region_${String(regions.length + 1).padStart(3, '0')}`;
      _regionContainerMap.set(regionId, container);

      regions.push({
        id: regionId,
        name,
        type,
        element_count: regionElements.length,
        visible,
        has_actions: Array.from(actionSet),
        preview,
        container_selector: selector,
      });
    }
  }

  // 未分配元素归入 "other"
  const unassigned = elements.filter((el) => !assigned.has(el.selector));
  if (unassigned.length > 0) {
    const actionSet = new Set<string>();
    for (const el of unassigned) {
      if (el.text && isActionText(el.text)) actionSet.add(el.text);
    }
    const preview = unassigned
      .slice(0, 6)
      .map((el) => el.text || el.label || el.type)
      .filter(Boolean)
      .join(' | ')
      .slice(0, 120);
    regions.push({
      id: `region_${String(regions.length + 1).padStart(3, '0')}`,
      name: '其他',
      type: 'other',
      element_count: unassigned.length,
      visible: true,
      has_actions: Array.from(actionSet),
      preview,
      container_selector: '',
    });
  }

  return regions;
}

/**
 * 基于字符串生成稳定的短 hash（4 位十六进制），用于 el_id。
 * 同一 selector 多次扫描生成相同的 id，保证元素标识稳定。
 */
function stableHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // 32-bit int hash
  }
  // 转为正数的 4 位十六进制
  return (hash >>> 0).toString(16).slice(-4).padStart(4, '0');
}

/**
 * Check if a short text looks like a row-level action (修改/删除/编辑 etc.).
 * Used to identify distinct actionable elements inside table rows.
 */
function isActionText(text: string): boolean {
  const actionWords = [
    '修改', '删除', '编辑', '查看', '详情', '审批', '驳回', '通过',
    '确认', '取消', '启用', '停用', '下载', '导出', '打印', '复制',
  ];
  return actionWords.some((w) => text === w);
}

/**
 * Check if an element inside a table row is a distinct action target
 * (e.g. "修改"/"删除"/"编辑" links or buttons), as opposed to a generic
 * clickable area that just triggers the row's own click handler.
 */
function isRowAction(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' || tag === 'button') return true;
  const text = el.textContent?.trim() ?? '';
  // Short action-like texts that are distinct from the row itself
  const actionWords = ['修改', '删除', '编辑', '查看', '详情', '审批', '驳回', '通过', '确认', '取消'];
  return actionWords.some((w) => text === w || text.startsWith(w));
}

/**
 * Native interactive tags — these carry their own click semantics and should
 * always win over layout wrappers (div/span) during de-duplication.
 */
function isNativeInteractive(el: Element): boolean {
  return ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
}

/**
 * Check if an element has click-like interactivity via inline styles or class hints.
 * Catches Ant Design / custom components that use div + cursor:pointer.
 */
function isClickable(el: Element): boolean {
  try {
    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer') {
      // Only count as clickable if it has meaningful text or is a known interactive pattern
      const tag = el.tagName.toLowerCase();
      // Skip generic wrappers that are too high in the tree
      if (tag === 'div' || tag === 'span') {
        // Must have direct text content (not just child element text)
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent?.trim())
          .filter(Boolean)
          .join('');
        // Or have a class/attribute suggesting interactivity
        const cls = el.className?.toString() ?? '';
        const hasInteractiveHint = cls.includes('btn') || cls.includes('click') ||
          cls.includes('trigger') || cls.includes('item-row') || cls.includes('cursor') ||
          el.hasAttribute('data-action') || el.hasAttribute('data-href');
        if (directText || hasInteractiveHint) return true;
        // Also include if it has a short textContent and few children
        const text = el.textContent?.trim() ?? '';
        if (text.length > 0 && text.length <= 30 && el.children.length <= 3) return true;
      }
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

function isVisible(el: Element): boolean {
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top < window.innerHeight &&
      rect.bottom > 0
    );
  } catch {
    return false;
  }
}

/**
 * 生成元素的唯一 CSS selector。
 * 优先使用 id 属性，否则构造 nth-child 路径。
 */
function buildSelector(el: Element): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;

    const tag = current.tagName.toLowerCase();
    // 同 tagName 的兄弟节点（nth-of-type 语义）
    const siblings = Array.from(parent.children).filter(
      (c: Element) => c.tagName === current!.tagName
    );

    if (siblings.length === 1) {
      parts.unshift(tag);
    } else {
      // 用 nth-of-type，索引是在同 tagName 兄弟中的位置（1-indexed）
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    }

    current = parent;
  }

  return parts.join(' > ') || el.tagName.toLowerCase();
}

/**
 * 判断元素或其祖先是否携带 data-aa-sdk="true"，用于过滤 SDK 自身注入的元素。
 */
function isSDKElement(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node.getAttribute('data-aa-sdk') === 'true') return true;
    node = node.parentElement;
  }
  return false;
}

function getElementType(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'a';
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') {
    return tag;
  }
  const role = el.getAttribute('role');
  if (role) return role;
  return tag;
}

/**
 * Extract table context for an element inside a <table>.
 * Returns { row, col, header } or null if not in a table body.
 */
function getTableContext(el: Element): { row: number; col: number; header: string } | null {
  // Walk up to find the containing <td> or <th>
  let cell: Element | null = el;
  while (cell && cell.tagName !== 'TD' && cell.tagName !== 'TH') {
    cell = cell.parentElement;
  }
  if (!cell) return null;

  // Find the containing <tr>
  const tr = cell.closest('tr');
  if (!tr) return null;

  // Find the containing <table>
  const table = cell.closest('table');
  if (!table) return null;

  // If the cell is in <thead>, it's a header — don't add table context
  if (cell.closest('thead')) return null;

  // Column index (1-based)
  const colIndex = Array.from(tr.children).indexOf(cell) + 1;

  // Row index within <tbody> (1-based, excluding header rows)
  const tbody = cell.closest('tbody');
  if (!tbody) return null;
  const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
  const rowIndex = rows.indexOf(tr) + 1;
  // Skip if rowIndex is 0 (not found)
  if (rowIndex < 1) return null;

  // Find the corresponding header text from <thead>
  // Use computeHeaderLabels (handles rowspan/colspan multi-row headers correctly)
  let header = '';
  const headerLabels = computeHeaderLabels(table);
  if (colIndex <= headerLabels.length) {
    header = headerLabels[colIndex - 1] ?? '';
  }
  // Strip leading "* " (required-field marker) so the model sees clean column names
  header = header.replace(/^\*\s*/, '');

  return { row: rowIndex, col: colIndex, header };
}

/**
 * Extract a label for the element from aria-label, associated <label>, or parent context.
 */
function getLabel(el: Element): string | null {
  // 1. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // 2. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() ?? null;
  }

  // 3. <label for="id">
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent?.trim() ?? null;
  }

  // 4. Wrapping <label>
  const parentLabel = el.closest('label');
  if (parentLabel) {
    // Get label text excluding the element's own text
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea, button').forEach(c => c.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // 5. title attribute
  const title = el.getAttribute('title');
  if (title) return title.trim();

  return null;
}

/**
 * Detect event listeners bound to an element.
 * Supports: React (via __reactProps$), Vue (via __vue__), and native onclick/onchange attributes.
 */
function detectEvents(el: Element): string[] {
  const events = new Set<string>();

  // 1. Native HTML event attributes
  const nativeEvents = ['onclick', 'onchange', 'oninput', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onmousedown', 'onmouseup'];
  for (const attr of nativeEvents) {
    if ((el as any)[attr]) {
      events.add(attr.slice(2)); // "onclick" → "click"
    }
  }

  // 2. React synthetic events (React 16+ stores props on __reactProps$xxx)
  for (const key of Object.keys(el)) {
    if (key.startsWith('__reactProps$') || key.startsWith('__reactEvents$')) {
      const props = (el as any)[key];
      if (props && typeof props === 'object') {
        for (const propName of Object.keys(props)) {
          if (propName.startsWith('on') && typeof props[propName] === 'function') {
            // "onClick" → "click", "onChange" → "change"
            const eventName = propName.slice(2).toLowerCase();
            events.add(eventName);
          }
        }
      }
    }
    // React 18+ fiber: check memoizedProps
    if (key.startsWith('__reactFiber$')) {
      try {
        const fiber = (el as any)[key];
        const memoizedProps = fiber?.memoizedProps;
        if (memoizedProps && typeof memoizedProps === 'object') {
          for (const propName of Object.keys(memoizedProps)) {
            if (propName.startsWith('on') && typeof memoizedProps[propName] === 'function') {
              events.add(propName.slice(2).toLowerCase());
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  // 3. Vue event listeners (Vue 2: __vue__, Vue 3: __vue_app__)
  const vueInstance = (el as any).__vue__;
  if (vueInstance?.$listeners) {
    for (const eventName of Object.keys(vueInstance.$listeners)) {
      events.add(eventName);
    }
  }

  // Filter to only meaningful interaction events
  const meaningful = ['click', 'change', 'input', 'focus', 'blur', 'mousedown', 'mouseup',
    'keydown', 'keyup', 'submit', 'dblclick', 'contextmenu', 'select'];
  const result = Array.from(events).filter(e => meaningful.includes(e));
  return result.length > 0 ? result : [];
}

export class PageScanner {
  scan(): ScanResult {
    const combined = SELECTORS.join(', ');
    const nodeList = document.querySelectorAll(combined);
    const raw: Element[] = [];

    nodeList.forEach((el) => {
      if (!isSDKElement(el)) {
        raw.push(el);
      }
    });

    // Also find cursor:pointer elements not matched by selectors
    const allElements = document.querySelectorAll('div, span, li, img, svg, label, a');
    allElements.forEach((el) => {
      if (!isSDKElement(el) && !raw.includes(el) && isClickable(el)) {
        // Skip if a parent is already in the list (avoid duplicating nested clickables).
        // Exception: elements inside table rows that have their own action semantics
        // (e.g. "修改"/"删除" links) should be kept even when the tr is also listed.
        let dominated = false;
        for (const existing of raw) {
          if (existing.contains(el) && existing !== el) {
            // Don't skip if this element is a distinct action inside a table row
            if (existing.tagName === 'TR' && isRowAction(el)) {
              continue;
            }
            // Native interactive elements (a/button/input/...) are never
            // dominated by layout containers (div/span/...) — e.g. an <a>
            // action link inside a clickable div wrapper must stay clickable
            // on its own, otherwise clicks land between sibling links.
            if (isNativeInteractive(el) && !isNativeInteractive(existing)) {
              continue;
            }
            dominated = true;
            break;
          }
          // Reverse containment: this element is a layout wrapper around an
          // already-collected native interactive element (e.g. ant-space div
          // wrapping "完成"/"删除" links). The child is the real click target —
          // skip the wrapper so the model doesn't click between the links.
          if (el.contains(existing) && existing !== el
              && isNativeInteractive(existing) && !isNativeInteractive(el)) {
            dominated = true;
            break;
          }
        }
        if (!dominated) {
          raw.push(el);
        }
      }
    });

    // Scan table body rows as clickable elements (Ant Design tables use tr click for selection)
    const tableRows = document.querySelectorAll('tbody > tr[class*="ant-table-row"], tbody > tr[data-row-key]');
    tableRows.forEach((tr) => {
      if (!isSDKElement(tr) && !raw.includes(tr) && isVisible(tr)) {
        raw.push(tr);
      }

      // Also scan action elements inside table rows (修改/删除/编辑 buttons or links)
      // that may not have their own click events but are distinct actionable targets.
      // Strategy: find leaf-level elements whose text is exactly an action word.
      const allDescendants = tr.querySelectorAll('a, button, [role="button"], span, div, td');
      allDescendants.forEach((actionEl) => {
        if (!isSDKElement(actionEl) && !raw.includes(actionEl) && isVisible(actionEl)) {
          const text = actionEl.textContent?.trim() ?? '';
          // Only leaf-level elements with exact action text (修改/删除/编辑 etc.)
          // Skip containers that combine multiple actions (e.g. "修改删除" wrapper)
          if (isActionText(text) && actionEl.children.length === 0) {
            raw.push(actionEl);
          }
        }
      });
    });

    // 去重（同一元素可能匹配多个选择器）
    const unique = Array.from(new Set(raw));

    // 构建 DOMElement 列表（稳定 el_id：基于 selector 的短 hash，同一元素多次扫描 id 不变）
    const all: DOMElement[] = unique.map((el) => {
      const selector = buildSelector(el);
      const id = `el_${stableHash(selector)}`;
      const tag = el.tagName.toLowerCase();
      let type = getElementType(el);
      const visible = isVisible(el);

      // Special handling for table rows: extract cell summary
      let text: string | null = null;
      if (tag === 'tr' && el.closest('tbody')) {
        type = 'table-row';
        const cells = el.querySelectorAll('td');
        const cellTexts: string[] = [];
        cells.forEach((td) => {
          const t = td.textContent?.trim();
          if (t && t.length > 0 && t !== '\u00a0') cellTexts.push(t);
        });
        text = cellTexts.length > 0 ? cellTexts.join(' | ') : null;
        if (text && text.length > 150) text = text.slice(0, 150) + '…';
      } else {
        const rawText = (el as HTMLElement).textContent?.trim() ?? null;
        text = rawText ? rawText.slice(0, 100) : null;
      }

      const element: DOMElement = { id, type, text, selector, visible };

      if (tag === 'input' || tag === 'textarea') {
        const placeholder = (el as HTMLInputElement | HTMLTextAreaElement).placeholder;
        if (placeholder !== undefined) {
          element.placeholder = placeholder;
        }
        const value = (el as HTMLInputElement | HTMLTextAreaElement).value;
        if (value) {
          element.value = value;
        }
      }

      if (tag === 'a') {
        const href = (el as HTMLAnchorElement).getAttribute('href');
        if (href !== null) {
          element.href = href;
        }
      }

      // Table context: row/col/header for elements inside <tbody>
      const tableCtx = getTableContext(el);
      if (tableCtx) {
        element.table = tableCtx;
      }

      // For table-row type, add row index
      if (type === 'table-row') {
        const tbody = el.closest('tbody');
        const table = el.closest('table');
        if (tbody && table) {
          const rows = Array.from(tbody.querySelectorAll(':scope > tr')).filter(
            r => !r.classList.contains('ant-table-measure-row') && !r.getAttribute('aria-hidden')
          );
          const rowIdx = rows.indexOf(el) + 1;
          if (rowIdx > 0) {
            element.table = { row: rowIdx, col: 0, header: '(entire row — click to select)' };
          }
        }
      }

      // Label from aria-label, <label>, title, etc.
      const label = getLabel(el);
      if (label && label !== text) {
        element.label = label;
      }

      // Mark thead elements as columnheader
      if (el.closest('thead') || el.tagName === 'TH') {
        element.role = 'columnheader';
      }

      // Detect bound event listeners
      const events = detectEvents(el);
      if (events.length > 0) {
        element.events = events;
      }

      return element;
    });

    // 截断策略：超过 200 个时优先保留 visible:true，再补充 visible:false 至 200
    if (all.length <= MAX_ELEMENTS) {
      return {
        elements: all,
        truncated: false,
        regions: extractRegions(all),
        ...this.buildDiscoverySummaries(),
      };
    }

    const visible = all.filter((e) => e.visible);
    const invisible = all.filter((e) => !e.visible);

    let elements: DOMElement[];
    if (visible.length >= MAX_ELEMENTS) {
      elements = visible.slice(0, MAX_ELEMENTS);
    } else {
      const remaining = MAX_ELEMENTS - visible.length;
      elements = [...visible, ...invisible.slice(0, remaining)];
    }

    return {
      elements,
      truncated: true,
      regions: extractRegions(elements),
      ...this.buildDiscoverySummaries(),
    };
  }

  /**
   * Overview-level discovery summaries for every readable content block on
   * the page — tables, charts and text blocks — plus the page outline.
   * Cheap enough to include in every page_skill call.
   */
  private buildDiscoverySummaries(): {
    page_outline: PageOutlineItem[];
    data_tables: DataTableSummary[];
    charts: ChartSummary[];
    text_blocks: TextBlockSummary[];
  } {
    return {
      page_outline: extractPageOutline(),
      data_tables: collectDataTableData().map((t, i) => ({
        id: `table_${String(i + 1).padStart(3, '0')}`,
        title: t.title,
        headers: t.headers,
        col_count: t.headers.length || t.rows[0]?.length || 0,
        row_count: t.rows.length,
        preview: t.rows.slice(0, PREVIEW_ROWS).map(joinRow),
      })),
      charts: collectChartData().map((c, i) => ({
        id: `chart_${String(i + 1).padStart(3, '0')}`,
        title: c.title,
        types: [...new Set(c.series.map((s) => String(s.type ?? '')).filter(Boolean))],
        series_names: c.series.map((s) => String(s.name ?? '')).filter(Boolean),
        data_points: c.option
          ? c.series.reduce(
              (sum, s) => sum + (Array.isArray(s.data) ? s.data.length : 0),
              0
            )
          : -1,
        readable: c.option !== null,
      })),
      text_blocks: collectTextBlocks().map((b, i) => ({
        id: `text_${String(i + 1).padStart(3, '0')}`,
        title: b.title,
        chars: b.own_text.length,
        preview: b.own_text.slice(0, 120),
      })),
    };
  }

  /**
   * 搜索页面元素：按关键词在所有元素中做全文匹配。
   * 匹配字段：text / label / placeholder / value / selector / table.header。
   * 支持多关键词（空格分隔，AND 语义）。
   * 返回匹配的元素列表（含 el_id/type/text/label/table 上下文），按相关度排序。
   */
  searchElements(query: string): Record<string, unknown> {
    const { elements } = this.scan();
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return { query, match_count: 0, elements: [] };

    const scored: Array<{ el: DOMElement; score: number }> = [];

    for (const el of elements) {
      // 构建可搜索文本
      const searchable = [
        el.text,
        el.label,
        el.placeholder,
        el.value,
        el.selector,
        el.table?.header,
        el.type,
        el.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // 计算匹配分数：每个关键词命中加分，精确匹配文本加分更多
      let score = 0;
      let allMatched = true;
      for (const kw of keywords) {
        if (searchable.includes(kw)) {
          score += 1;
          // 精确匹配 text 或 label 加分
          if (el.text?.toLowerCase() === kw || el.label?.toLowerCase() === kw) {
            score += 3;
          }
          // text/label 包含关键词加分
          else if (el.text?.toLowerCase().includes(kw) || el.label?.toLowerCase().includes(kw)) {
            score += 2;
          }
        } else {
          allMatched = false;
          break;
        }
      }

      if (allMatched && score > 0) {
        scored.push({ el, score });
      }
    }

    // 按相关度排序
    scored.sort((a, b) => b.score - a.score);
    const matched = scored.slice(0, 30).map(({ el }) => el);

    return {
      query,
      match_count: matched.length,
      elements: matched,
    };
  }

  /**
   * Full content of a single block discovered in an overview scan, addressed
   * by block_id: "table_001" | "chart_001" | "text_001" | "region_001" | "el_001".
   * Returns null when the id doesn't match the current DOM.
   */
  getBlockDetail(blockId: string): Record<string, unknown> | null {
    if (blockId.startsWith('table_')) return this.getTableDetail(blockId);
    if (blockId.startsWith('chart_')) return this.getChartDetail(blockId);
    if (blockId.startsWith('text_')) return this.getTextDetail(blockId);
    if (blockId.startsWith('region_')) return this.getRegionElements(blockId);
    if (blockId.startsWith('el_')) return this.getElementDetail(blockId);
    return null;
  }

  /**
   * 查看某个区域内的交互元素列表（渐进式披露第二层）。
   * region_id 来自总览扫描的 regions 字段。
   * 用 extractRegions 时存的容器元素引用匹配，不用索引猜选择器。
   */
  private getRegionElements(regionId: string): Record<string, unknown> | null {
    const { elements } = this.scan();
    const regions = extractRegions(elements); // 重新填充 _regionContainerMap
    const region = regions.find((r) => r.id === regionId);
    if (!region) return null;

    // "other" 区域：返回所有未被其他区域分配的元素
    if (region.type === 'other') {
      const otherElements = elements.filter((el) => {
        for (const [, container] of _regionContainerMap) {
          const domEl = document.querySelector(el.selector);
          if (domEl && container.contains(domEl)) return false;
        }
        return true;
      });
      return {
        region_id: regionId,
        name: region.name,
        type: region.type,
        element_count: otherElements.length,
        elements: otherElements.slice(0, 50),
      };
    }

    // 用容器元素引用匹配
    const container = _regionContainerMap.get(regionId);
    if (!container) return null;

    const regionElements = elements.filter((el) => {
      const domEl = document.querySelector(el.selector);
      return domEl && container.contains(domEl);
    });

    return {
      region_id: regionId,
      name: region.name,
      type: region.type,
      element_count: regionElements.length,
      elements: regionElements.slice(0, 50),
    };
  }

  /**
   * 查看单个元素的完整内容（渐进式披露第三层）。
   * el_id 来自 dom_snapshot 或区域元素列表。
   */
  private getElementDetail(elId: string): Record<string, unknown> | null {
    const { elements } = this.scan();
    const element = elements.find((e) => e.id === elId);
    if (!element) return null;

    const domEl = document.querySelector(element.selector);
    if (!domEl) return { el_id: elId, error: '元素在当前 DOM 中不存在（页面可能已变化）' };

    // 完整 outerHTML（截断到 2000 字符）
    const outerHTML = domEl.outerHTML.slice(0, 2000);

    // 计算样式关键属性
    const style = window.getComputedStyle(domEl);
    const computedStyle = {
      display: style.display,
      visibility: style.visibility,
      cursor: style.cursor,
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      zIndex: style.zIndex,
    };

    // 父链（最多 5 层）
    const ancestors: string[] = [];
    let node: Element | null = domEl.parentElement;
    while (node && ancestors.length < 5) {
      const tag = node.tagName.toLowerCase();
      const cls = node.className?.toString().split(' ').slice(0, 3).join('.') ?? '';
      ancestors.push(cls ? `${tag}.${cls}` : tag);
      node = node.parentElement;
    }

    // 子元素摘要
    const children = Array.from(domEl.children).slice(0, 10).map((child) => ({
      tag: child.tagName.toLowerCase(),
      text: child.textContent?.trim().slice(0, 50) ?? '',
      class: child.className?.toString().slice(0, 60) ?? '',
    }));

    return {
      el_id: elId,
      type: element.type,
      text: element.text,
      selector: element.selector,
      visible: element.visible,
      events: element.events,
      label: element.label,
      table: element.table,
      outerHTML,
      computedStyle,
      ancestors,
      children,
    };
  }

  private getTableDetail(tableId: string): Record<string, unknown> | null {
    const tables = collectDataTableData();
    const index = parseInt(tableId.replace('table_', ''), 10);
    if (!Number.isInteger(index) || index < 1 || index > tables.length) {
      return null;
    }
    const t = tables[index - 1];

    const lines: string[] = [];
    if (t.headers.length > 0) lines.push(t.headers.join(' | '));

    let truncated = false;
    let used = lines.join('\n').length;
    for (const row of t.rows) {
      if (lines.length - (t.headers.length ? 1 : 0) >= MAX_DETAIL_ROWS || used >= MAX_DETAIL_CHARS) {
        truncated = true;
        lines.push(`…(共 ${t.rows.length} 行，已截断)`);
        break;
      }
      const line = joinRow(row).slice(0, 400);
      lines.push(line);
      used += line.length;
    }

    return {
      table_id: tableId,
      title: t.title,
      headers: t.headers,
      row_count: t.rows.length,
      truncated,
      content: lines.join('\n'),
    };
  }

  private getChartDetail(chartId: string): Record<string, unknown> | null {
    const charts = collectChartData();
    const index = parseInt(chartId.replace('chart_', ''), 10);
    if (!Number.isInteger(index) || index < 1 || index > charts.length) {
      return null;
    }
    const c = charts[index - 1];

    if (!c.option) {
      return {
        chart_id: chartId,
        title: c.title,
        readable: false,
        error:
          'Chart data is not readable: the page does not expose a global echarts registry (window.echarts). Only the chart title is available.',
      };
    }

    const xAxis = c.option.xAxis as { data?: unknown[] } | undefined;
    const yAxis = c.option.yAxis as { data?: unknown[] } | undefined;
    const categories = xAxis?.data ?? yAxis?.data ?? [];

    const series = c.series.map((s) => ({
      name: s.name ?? '',
      type: s.type ?? '',
      data: Array.isArray(s.data) ? s.data.slice(0, 100) : [],
    }));

    const optionJson = JSON.stringify(c.option).slice(0, MAX_DETAIL_CHARS);

    return {
      chart_id: chartId,
      title: c.title,
      readable: true,
      categories,
      series,
      option: optionJson,
    };
  }

  private getTextDetail(textId: string): Record<string, unknown> | null {
    const blocks = collectTextBlocks();
    const index = parseInt(textId.replace('text_', ''), 10);
    if (!Number.isInteger(index) || index < 1 || index > blocks.length) {
      return null;
    }
    const b = blocks[index - 1];
    const truncated = b.own_text.length > MAX_DETAIL_CHARS;

    return {
      text_id: textId,
      title: b.title,
      chars: b.own_text.length,
      truncated,
      content: truncated ? b.own_text.slice(0, MAX_DETAIL_CHARS) + '…(已截断)' : b.own_text,
    };
  }

  toJSON(elements: DOMElement[]): string {
    const serialized = elements.map((el) => {
      const obj: Record<string, unknown> = {
        id: el.id,
        type: el.type,
        text: el.text,
        selector: el.selector,
        visible: el.visible,
      };
      if (el.placeholder !== undefined) obj.placeholder = el.placeholder;
      if (el.href !== undefined) obj.href = el.href;
      if (el.table) obj.table = el.table;
      if (el.label) obj.label = el.label;
      if (el.role) obj.role = el.role;
      if (el.events && el.events.length > 0) obj.events = el.events;
      return obj;
    });
    return JSON.stringify(serialized);
  }
}
