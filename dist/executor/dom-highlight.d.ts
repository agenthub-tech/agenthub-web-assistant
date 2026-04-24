import type { DOMElement } from '../types/dom';
import type { PageScanner } from './page-scanner';
export declare class DOMHighlight {
    private overlay;
    private scanner;
    constructor(scanner: PageScanner);
    /**
     * 高亮指定 el_id 的元素。
     * 每次调用时实时重新扫描 DOM，避免 React 重渲染后 snapshot 里的 selector 失效。
     * snapshot 参数保留用于兼容，但不再使用。
     */
    show(el_id: string, _snapshot: DOMElement[]): void;
    clear(): void;
}
