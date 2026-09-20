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
export declare class DOMExecutor {
    private scanner;
    constructor(scanner: PageScanner);
    private findElement;
    click(el_id: string): ExecuteResult;
    input(el_id: string, value: string): ExecuteResult;
    clear(el_id: string): ExecuteResult;
    /**
     * Find the largest visible element that actually has scrollable overflow
     * (scrollHeight > clientHeight). Skips SDK-injected UI (chat panel etc.)
     * and non-element nodes.
     */
    private findLargestScrollableContainer;
    scroll(el_id: string, direction: string, distance: number): ExecuteResult;
}
