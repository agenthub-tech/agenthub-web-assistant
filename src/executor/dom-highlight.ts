// DOMHighlight — 元素高亮遮罩
// 需求：16.1、16.2、16.3、16.4

import type { DOMElement } from '../types/dom';
import type { PageScanner } from './page-scanner';

export class DOMHighlight {
  private overlay: HTMLDivElement | null = null;
  private scanner: PageScanner;

  constructor(scanner: PageScanner) {
    this.scanner = scanner;
  }

  /**
   * 高亮指定 el_id 的元素。
   * 每次调用时实时重新扫描 DOM，避免 React 重渲染后 snapshot 里的 selector 失效。
   * snapshot 参数保留用于兼容，但不再使用。
   */
  show(el_id: string, _snapshot: DOMElement[]): void {
    this.clear();

    // 实时重新扫描，获取最新 selector
    const { elements } = this.scanner.scan();
    const element = elements.find((e) => e.id === el_id);
    if (!element) {
      console.warn(`[DOMHighlight] el_id '${el_id}' not found in live scan`);
      return;
    }

    const targetEl = document.querySelector(element.selector);
    if (!targetEl) {
      console.warn(`[DOMHighlight] selector '${element.selector}' not found in DOM`);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.setAttribute('data-aa-sdk', 'true');
    overlay.style.cssText = `
      position: fixed;
      background: rgba(59, 130, 246, 0.3);
      border: 2px solid #3B82F6;
      pointer-events: none;
      z-index: 99999;
      transition: all 0.15s ease;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  clear(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
