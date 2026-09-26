import { renderMarkdown } from '../src/core/markdown.js';
import { assertEqual, assertFalse, assertIncludes, test } from './harness.mjs';

test('headings of every level render', () => {
  assertEqual(renderMarkdown('# عنوان'), '<h1>عنوان</h1>');
  assertEqual(renderMarkdown('### عنوان'), '<h3>عنوان</h3>');
});

test('raw html in a document is escaped, never executed', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');
  assertIncludes(html, '&lt;img');
  assertFalse(html.includes('<img'), 'no raw tag may survive');
});

test('inline code is preserved verbatim and not transformed', () => {
  assertEqual(renderMarkdown('استخدم `**not bold**` هنا'), '<p>استخدم <code>**not bold**</code> هنا</p>');
});

test('bold, links and external-link safety', () => {
  assertIncludes(renderMarkdown('هذا **مهم** جدًا'), '<strong>مهم</strong>');
  assertIncludes(renderMarkdown('[توثيق](./docs/DATA_SOURCES.md)'), 'href="./docs/DATA_SOURCES.md"');
  assertIncludes(renderMarkdown('[خارجي](https://example.com)'), 'rel="noopener"');
  assertIncludes(renderMarkdown('[خطير](javascript:alert(1))'), 'href="#"');
});

test('unordered and ordered lists are grouped correctly', () => {
  assertEqual(renderMarkdown('- واحد\n- اثنان'), '<ul>\n<li>واحد</li>\n<li>اثنان</li>\n</ul>');
  assertEqual(renderMarkdown('1. أول\n2. ثانٍ'), '<ol>\n<li>أول</li>\n<li>ثانٍ</li>\n</ol>');
  assertEqual(renderMarkdown('- واحد\n\ntext'), '<ul>\n<li>واحد</li>\n</ul>\n<p>text</p>');
});

test('tables require a separator row and pad short rows', () => {
  const html = renderMarkdown('| أ | ب |\n|---|---|\n| 1 | 2 |\n| 3 |');
  assertIncludes(html, '<th>أ</th>');
  assertIncludes(html, '<td>1</td>');
  assertIncludes(html, '<td></td>');
  assertFalse(renderMarkdown('| أ | ب |').includes('<table'), 'a lone pipe row is not a table');
});

test('fenced code blocks keep their content unparsed', () => {
  const html = renderMarkdown('```bash\nnode server.mjs\n```');
  assertIncludes(html, '<pre class="md-code" data-lang="bash">');
  assertIncludes(html, 'node server.mjs');
  assertIncludes(html, '<code>');
});

test('blockquotes, rules and paragraphs', () => {
  assertIncludes(renderMarkdown('> اقتباس'), '<blockquote>اقتباس</blockquote>');
  assertIncludes(renderMarkdown('---'), '<hr />');
  assertEqual(renderMarkdown('سطر أول\nسطر ثانٍ'), '<p>سطر أول سطر ثانٍ</p>');
});

test('an empty document renders nothing instead of throwing', () => {
  assertEqual(renderMarkdown(''), '');
  assertEqual(renderMarkdown(null), '');
});
