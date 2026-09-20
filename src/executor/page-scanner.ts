// PageScanner — DOM 快照提取
// 需求：4.1、4.2、4.3、4.4、4.5、4.6、4.7、4.8、5.1、5.2

import type { DOMElement, ScanResult, PageOutlineItem, DataTableSummary, ChartSummary, TextBlockSummary } from '../types/dom';

const SELECTORS = [
  'button',
  'input',
  'textarea',
  'select',
  'a[href]',
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
  let header = '';
  const thead = table.querySelector('thead');
  if (thead) {
    // Get the last header row (in case of multi-row headers)
    const headerRows = thead.querySelectorAll('tr');
    const lastHeaderRow = headerRows[headerRows.length - 1];
    if (lastHeaderRow) {
      const headerCells = lastHeaderRow.querySelectorAll('th, td');
      if (colIndex <= headerCells.length) {
        header = headerCells[colIndex - 1]?.textContent?.trim() ?? '';
      }
    }
  }

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
    const allElements = document.querySelectorAll('div, span, li, img, svg, label');
    allElements.forEach((el) => {
      if (!isSDKElement(el) && !raw.includes(el) && isClickable(el)) {
        // Skip if a parent is already in the list (avoid duplicating nested clickables)
        let dominated = false;
        for (const existing of raw) {
          if (existing.contains(el) && existing !== el) {
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
    });

    // 去重（同一元素可能匹配多个选择器）
    const unique = Array.from(new Set(raw));

    // 构建 DOMElement 列表（1-indexed el_id）
    const all: DOMElement[] = unique.map((el, i) => {
      const id = `el_${String(i + 1).padStart(3, '0')}`;
      const tag = el.tagName.toLowerCase();
      let type = getElementType(el);
      const selector = buildSelector(el);
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
   * Full content of a single block discovered in an overview scan, addressed
   * by block_id: "table_001" | "chart_001" | "text_001". Returns null when
   * the id doesn't match the current DOM (e.g. the page changed) — the
   * caller should tell the agent to re-scan.
   */
  getBlockDetail(blockId: string): Record<string, unknown> | null {
    if (blockId.startsWith('table_')) return this.getTableDetail(blockId);
    if (blockId.startsWith('chart_')) return this.getChartDetail(blockId);
    if (blockId.startsWith('text_')) return this.getTextDetail(blockId);
    return null;
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
