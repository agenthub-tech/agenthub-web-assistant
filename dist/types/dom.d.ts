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
    href?: string;
    table?: TableContext;
    label?: string;
    role?: string;
    events?: string[];
}
export interface ScanResult {
    elements: DOMElement[];
    truncated: boolean;
}
