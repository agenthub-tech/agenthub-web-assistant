import type { DOMElement, ScanResult } from '../types/dom';
export declare class PageScanner {
    scan(): ScanResult;
    /**
     * Overview-level discovery summaries for every readable content block on
     * the page — tables, charts and text blocks — plus the page outline.
     * Cheap enough to include in every page_skill call.
     */
    private buildDiscoverySummaries;
    /**
     * Full content of a single block discovered in an overview scan, addressed
     * by block_id: "table_001" | "chart_001" | "text_001". Returns null when
     * the id doesn't match the current DOM (e.g. the page changed) — the
     * caller should tell the agent to re-scan.
     */
    getBlockDetail(blockId: string): Record<string, unknown> | null;
    private getTableDetail;
    private getChartDetail;
    private getTextDetail;
    toJSON(elements: DOMElement[]): string;
}
