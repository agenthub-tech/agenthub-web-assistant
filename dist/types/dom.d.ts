export interface TableContext {
    row: number;
    col: number;
    header: string;
}
export interface DOMElement {
    id: string;
    type: string;
    text: string | null;
    selector: string;
    visible: boolean;
    placeholder?: string;
    value?: string;
    href?: string;
    table?: TableContext;
    label?: string;
    role?: string;
    events?: string[];
}
export interface PageOutlineItem {
    level: number;
    text: string;
}
export interface DataTableSummary {
    id: string;
    title: string;
    headers: string[];
    col_count: number;
    row_count: number;
    preview: string[];
}
export interface ChartSummary {
    id: string;
    title: string;
    types: string[];
    series_names: string[];
    data_points: number;
    readable: boolean;
}
export interface TextBlockSummary {
    id: string;
    title: string;
    chars: number;
    preview: string;
}
export interface RegionSummary {
    id: string;
    name: string;
    type: string;
    element_count: number;
    visible: boolean;
    has_actions: string[];
    preview: string;
    container_selector: string;
}
export interface ScanResult {
    elements: DOMElement[];
    truncated: boolean;
    page_outline?: PageOutlineItem[];
    regions?: RegionSummary[];
    data_tables?: DataTableSummary[];
    charts?: ChartSummary[];
    text_blocks?: TextBlockSummary[];
}
