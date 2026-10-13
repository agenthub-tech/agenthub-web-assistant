/**
 * Lightweight Markdown → HTML renderer for chat bubbles.
 *
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```,
 * unordered lists (- / *), ordered lists (1.), headings (#–###),
 * links [text](url), images ![alt](url), and line breaks.
 *
 * Designed to be tiny (no external deps) and XSS-safe via escaping.
 * All emitted elements carry data-aa-sdk="true" so hosts can scope SDK-owned DOM.
 */
export declare function renderMarkdown(raw: string): string;
