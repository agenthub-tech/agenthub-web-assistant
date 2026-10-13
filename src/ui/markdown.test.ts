// renderMarkdown unit tests — image (Markdown) rendering support
//
// 背景：知识库回答需要图文并茂，AA 嵌入组件的自研渲染器原本只认链接
// 语法，![alt](url) 会被链接规则吃掉，因此这里锁定图片渲染行为。

import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown — 图片渲染', () => {
  it('把标准图片语法渲染为 img 标签', () => {
    const html = renderMarkdown('![血糖仪](https://example.com/a.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('alt="血糖仪"');
  });

  it('图片规则优先于链接规则，不产生锚点', () => {
    const html = renderMarkdown('![说明](https://example.com/a.png)');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('![');
  });

  it('纯链接语法仍渲染为锚点', () => {
    const html = renderMarkdown('[文档](https://example.com/doc)');
    expect(html).toContain('<a ');
    expect(html).toContain('href="https://example.com/doc"');
    expect(html).not.toContain('<img');
  });

  it('图片标签携带 data-aa-sdk 标记', () => {
    const html = renderMarkdown('![](https://example.com/a.png)');
    expect(html).toContain('data-aa-sdk="true"');
  });

  it('带签名的 URL 中 & 被转义为 &amp;（HTML 属性中语义等价）', () => {
    const html = renderMarkdown('![图](https://example.com/i.png?exp=1&sig=abc)');
    expect(html).toContain('src="https://example.com/i.png?exp=1&amp;sig=abc"');
  });

  it('alt 中的 HTML 被转义，不产生注入', () => {
    const html = renderMarkdown('![<script>alert(1)</script>](https://example.com/a.png)');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('代码块内的图片语法保持原样，不渲染', () => {
    const html = renderMarkdown('```\n![a](b.png)\n```');
    expect(html).toContain('<pre');
    expect(html).not.toContain('<img');
  });

  it('表格单元格内的图片渲染为 img', () => {
    const html = renderMarkdown('| 图示 |\n|---|---|\n| ![a](https://example.com/b.png) |');
    expect(html).toContain('<table');
    expect(html).toContain('<img');
  });

  it('图片与文字混排时两者都保留', () => {
    const html = renderMarkdown('这是说明文字\n\n![图](https://example.com/a.png)');
    expect(html).toContain('这是说明文字');
    expect(html).toContain('<img');
  });
});
