import type { DOMElement, ScanResult } from '../types/dom';
export declare class PageScanner {
    scan(): ScanResult;
    toJSON(elements: DOMElement[]): string;
}
