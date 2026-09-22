// DOM 元素与扫描结果类型定义

export interface TableContext {
  row: number;          // 数据行号（从 1 开始，表头不计入）
  col: number;          // 列号（从 1 开始）
  header: string;       // 对应的表头文本
}

export interface DOMElement {
  id: string;           // 稳定标识：基于 selector 的短 hash（如 "el_a3f2"），同一元素多次扫描 id 不变
  type: string;         // "button" | "input" | "textarea" | "select" | "a" | "table-row" | ...
  text: string | null;  // 可见文本，最多 100 字符
  selector: string;     // 唯一 CSS selector
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
  id: string;            // "region_001"
  name: string;          // 区域名称
  type: string;          // "table" | "form" | "nav" | "dialog" | "tabs" | "content" | "other"
  element_count: number;
  visible: boolean;      // 区域是否可见（弹窗可能隐藏）
  has_actions: string[]; // 区域内的操作类型（如 ["修改", "删除"]）
  preview: string;       // 前几个元素的文本预览
  container_selector: string; // 区域容器的 CSS selector（getRegionElements 直接用）
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
