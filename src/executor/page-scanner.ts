// PageScanner — DOM 快照提取
// 需求：4.1、4.2、4.3、4.4、4.5、4.6、4.7、4.8、5.1、5.2

import type { DOMElement, ScanResult } from '../types/dom';

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
      return { elements: all, truncated: false };
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

    return { elements, truncated: true };
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
