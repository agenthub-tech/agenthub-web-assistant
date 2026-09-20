// DOM 元素与扫描结果类型定义
// 需求：4.3、4.4、4.5、4.6

export interface TableContext {
  row: number;          // 数据行号（从 1 开始，表头不计入）
  col: number;          // 列号（从 1 开始）
  header: string;       // 对应的表头文本
}

export interface DOMElement {
  id: string;           // "el_001"
  type: string;         // "button" | "input" | "textarea" | "select" | "a" | "table-row" | ...
  text: string | null;  // 可见文本，最多 100 字符
  selector: string;     // 唯一 CSS selector
  visible: boolean;
  placeholder?: string; // input/textarea 专有
  value?: string;       // input/textarea/select 当前值（如已选的报告期间）
  href?: string;        // a 标签专有
  table?: TableContext;  // 表格内元素的行列上下文
  label?: string;       // 关联的 label 文本（通过 aria-label、label[for]、父级 label 等）
  role?: string;        // 语义角色（表头元素标记为 "columnheader"）
  events?: string[];    // 绑定的事件类型（如 ["click", "change"]）
}

export interface PageOutlineItem {
  level: number;         // heading level 1-6
  text: string;          // heading text
}

export interface DataTableSummary {
  id: string;            // "table_001" — pass to page_skill to fetch full content
  title: string;         // nearest heading/caption, e.g. "老业务品类收入明细（百万元）"
  headers: string[];     // column labels (multi-row headers joined with "/")
  col_count: number;
  row_count: number;     // total data rows
  preview: string[];     // first 2 data rows, " | " joined
}

export interface ChartSummary {
  id: string;            // "chart_001"
  title: string;         // echarts option title / aria-label / nearest heading
  types: string[];       // series types, e.g. ["bar", "line"]
  series_names: string[];
  data_points: number;   // total data points across series; -1 when unreadable
  readable: boolean;     // false when the page's echarts registry is not reachable
}

export interface TextBlockSummary {
  id: string;            // "text_001"
  title: string;         // nearest heading, may be empty
  chars: number;         // total text length
  preview: string;       // first ~120 chars
}

export interface ScanResult {
  elements: DOMElement[];
  truncated: boolean;
  /** Page module structure: all visible headings, in document order. */
  page_outline?: PageOutlineItem[];
  /**
   * Content discovery summaries — tables, charts and text blocks found on
   * the page. Full content is fetched on demand via page_skill(block_id),
   * keeping the overview payload small (progressive discovery).
   */
  data_tables?: DataTableSummary[];
  charts?: ChartSummary[];
  text_blocks?: TextBlockSummary[];
}
