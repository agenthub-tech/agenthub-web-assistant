import type { PageScanner } from './page-scanner';
export interface ExecuteResult {
    action: 'click' | 'input' | 'scroll' | 'clear';
    el_id: string;
    success: boolean;
    error?: string;
    value?: string;
    scrollTop?: number;
}
export declare class DOMExecutor {
    private scanner;
    constructor(scanner: PageScanner);
    private findElement;
    click(el_id: string): ExecuteResult;
    input(el_id: string, value: string): ExecuteResult;
    clear(el_id: string): ExecuteResult;
    scroll(el_id: string, direction: string, distance: number): ExecuteResult;
}
