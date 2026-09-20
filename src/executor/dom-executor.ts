// DOMExecutor — DOM 操作执行
// 需求：6.1、6.2、6.3、6.4、7.1、7.2、7.3、7.4、8.1、8.2、8.3

import type { DOMElement } from '../types/dom';
import type { PageScanner } from './page-scanner';

export interface ExecuteResult {
  action: 'click' | 'input' | 'scroll' | 'clear';
  el_id: string;
  success: boolean;
  error?: string;
  value?: string;
  scrollTop?: number;
  /** True when the page itself doesn't scroll and an inner container was scrolled instead. */
  scrolled_container?: boolean;
}

export class DOMExecutor {
  constructor(private scanner: PageScanner) {}

  private findElement(el_id: string): { element: DOMElement; domEl: Element } | { error: string } {
    const { elements } = this.scanner.scan();
    const element = elements.find((e) => e.id === el_id);

    if (!element) {
      return { error: `Element '${el_id}' not found in snapshot` };
    }

    if (!element.visible) {
      return { error: `Element '${el_id}' is not visible` };
    }

    const domEl = document.querySelector(element.selector);
    if (!domEl) {
      return { error: `Element '${el_id}' not found in snapshot` };
    }

    return { element, domEl };
  }

  click(el_id: string): ExecuteResult {
    const result = this.findElement(el_id);

    if ('error' in result) {
      return { action: 'click', el_id, success: false, error: result.error };
    }

    try {
      (result.domEl as HTMLElement).click();
    } catch {
      result.domEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    return { action: 'click', el_id, success: true };
  }

  input(el_id: string, value: string): ExecuteResult {
    const result = this.findElement(el_id);

    if ('error' in result) {
      return { action: 'input', el_id, success: false, error: result.error };
    }

    const { domEl } = result;
    const tag = domEl.tagName.toLowerCase();
    const isContentEditable = (domEl as HTMLElement).isContentEditable;

    if (tag !== 'input' && tag !== 'textarea' && !isContentEditable) {
      return {
        action: 'input',
        el_id,
        success: false,
        error: `Element '${el_id}' is not an input element`,
      };
    }

    try {
      (domEl as HTMLElement).focus();
      domEl.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

      if (isContentEditable) {
        (domEl as HTMLElement).textContent = value;
      } else {
        // 使用 nativeInputValueSetter 触发 React/Vue 等框架的响应式更新
        const proto =
          tag === 'textarea'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeValueSetter) {
          nativeValueSetter.call(domEl, value);
        } else {
          (domEl as HTMLInputElement | HTMLTextAreaElement).value = value;
        }
      }

      domEl.dispatchEvent(new Event('input', { bubbles: true }));
      domEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      return {
        action: 'input',
        el_id,
        success: false,
        error: `Element '${el_id}' is not an input element`,
      };
    }

    return { action: 'input', el_id, success: true, value };
  }

  clear(el_id: string): ExecuteResult {
    const result = this.findElement(el_id);

    if ('error' in result) {
      return { action: 'clear', el_id, success: false, error: result.error };
    }

    const { domEl } = result;
    const tag = domEl.tagName.toLowerCase();
    const isContentEditable = (domEl as HTMLElement).isContentEditable;

    if (tag !== 'input' && tag !== 'textarea' && !isContentEditable) {
      return {
        action: 'clear',
        el_id,
        success: false,
        error: `Element '${el_id}' is not an input element`,
      };
    }

    try {
      if (isContentEditable) {
        (domEl as HTMLElement).textContent = '';
      } else {
        const proto =
          tag === 'textarea'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeValueSetter) {
          nativeValueSetter.call(domEl, '');
        } else {
          (domEl as HTMLInputElement | HTMLTextAreaElement).value = '';
        }
      }

      domEl.dispatchEvent(new Event('input', { bubbles: true }));
      domEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // ignore
    }

    return { action: 'clear', el_id, success: true };
  }

  /**
   * Find the largest visible element that actually has scrollable overflow
   * (scrollHeight > clientHeight). Skips SDK-injected UI (chat panel etc.)
   * and non-element nodes.
   */
  private findLargestScrollableContainer(): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestArea = 0;

    const candidates = document.querySelectorAll<HTMLElement>('div, main, section');
    candidates.forEach((el) => {
      if (el.closest('[data-aa-sdk="true"]')) return;
      if (el.scrollHeight <= el.clientHeight + 8) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    });

    return best;
  }

  scroll(el_id: string, direction: string, distance: number): ExecuteResult {
    if (direction !== 'up' && direction !== 'down') {
      return {
        action: 'scroll',
        el_id,
        success: false,
        error: `Invalid direction: '${direction}'`,
      };
    }

    const delta = direction === 'down' ? distance : -distance;

    if (el_id === 'window') {
      window.scrollBy({ top: delta, behavior: 'smooth' });

      // App-shell layouts often scroll inside a dedicated container while the
      // document itself never scrolls (window.scrollY stays 0). Fall back to
      // the largest scrollable container so "scroll window" still works.
      const docScrollable =
        document.documentElement.scrollHeight > window.innerHeight + 8;
      if (!docScrollable) {
        const container = this.findLargestScrollableContainer();
        if (container) {
          container.scrollBy({ top: delta, behavior: 'smooth' });
          return {
            action: 'scroll',
            el_id,
            success: true,
            scrollTop: Math.round(container.scrollTop),
            scrolled_container: true,
          };
        }
      }
      return {
        action: 'scroll',
        el_id,
        success: true,
        scrollTop: window.scrollY,
      };
    }

    const result = this.findElement(el_id);

    if ('error' in result) {
      return { action: 'scroll', el_id, success: false, error: result.error };
    }

    const { domEl } = result;
    (domEl as HTMLElement).scrollBy({ top: delta, behavior: 'smooth' });

    return {
      action: 'scroll',
      el_id,
      success: true,
      scrollTop: (domEl as HTMLElement).scrollTop,
    };
  }
}
