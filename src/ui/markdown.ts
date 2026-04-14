/**
 * Lightweight Markdown → HTML renderer for chat bubbles.
 *
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```,
 * unordered lists (- / *), ordered lists (1.), headings (#–###),
 * links [text](url), and line breaks.
 *
 * Designed to be tiny (no external deps) and XSS-safe via escaping.
 */

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Render inline markdown tokens (bold, italic, code, links). */
function inlineRender(text: string): string {
  let s = esc(text);
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code style="background:#E5E7EB;padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>');
  // bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#2563EB;text-decoration:underline;">$1</a>');
  return s;
}

export function renderMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ───────────────────────────────────────────────
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++; // skip opening fence
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      i++; // skip closing fence
      out.push(
        `<pre style="background:#1F2937;color:#F9FAFB;padding:10px 12px;border-radius:6px;overflow-x:auto;font-size:0.85em;line-height:1.5;margin:4px 0;">${codeLines.join('\n')}</pre>`,
      );
      continue;
    }

    // ── Heading ─────────────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = ['1.15em', '1.05em', '1em'];
      out.push(`<div style="font-weight:600;font-size:${sizes[level - 1]};margin:6px 0 2px;">${inlineRender(headingMatch[2])}</div>`);
      i++;
      continue;
    }

    // ── Unordered list ──────────────────────────────────────────────────
    if (/^[\s]*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i])) {
        items.push(`<li style="margin:1px 0;">${inlineRender(lines[i].replace(/^[\s]*[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul style="margin:4px 0;padding-left:20px;">${items.join('')}</ul>`);
      continue;
    }

    // ── Ordered list ────────────────────────────────────────────────────
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
        items.push(`<li style="margin:1px 0;">${inlineRender(lines[i].replace(/^[\s]*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol style="margin:4px 0;padding-left:20px;">${items.join('')}</ol>`);
      continue;
    }

    // ── Empty line → spacing ────────────────────────────────────────────
    if (line.trim() === '') {
      out.push('<div style="height:6px;"></div>');
      i++;
      continue;
    }

    // ── Normal paragraph ────────────────────────────────────────────────
    out.push(`<div>${inlineRender(line)}</div>`);
    i++;
  }

  return out.join('');
}
