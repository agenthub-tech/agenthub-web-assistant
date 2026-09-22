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
     * 搜索页面元素：按关键词在所有元素中做全文匹配。
     * 匹配字段：text / label / placeholder / value / selector / table.header。
     * 支持多关键词（空格分隔，AND 语义）。
     * 返回匹配的元素列表（含 el_id/type/text/label/table 上下文），按相关度排序。
     */
    searchElements(query: string): Record<string, unknown>;
    /**
     * Full content of a single block discovered in an overview scan, addressed
     * by block_id: "table_001" | "chart_001" | "text_001" | "region_001" | "el_001".
     * Returns null when the id doesn't match the current DOM.
     */
    getBlockDetail(blockId: string): Record<string, unknown> | null;
    /**
     * 查看某个区域内的交互元素列表（渐进式披露第二层）。
     * region_id 来自总览扫描的 regions 字段。
     * 用 extractRegions 时存的容器元素引用匹配，不用索引猜选择器。
     */
    private getRegionElements;
    /**
     * 查看单个元素的完整内容（渐进式披露第三层）。
     * el_id 来自 dom_snapshot 或区域元素列表。
     */
    private getElementDetail;
    private getTableDetail;
    private getChartDetail;
    private getTextDetail;
    toJSON(elements: DOMElement[]): string;
}
