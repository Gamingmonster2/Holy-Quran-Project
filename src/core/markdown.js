/**
 * Minimal, dependency-free Markdown renderer.
 *
 * Only the subset used by this project's own documentation is supported:
 * headings, paragraphs, ordered/unordered lists, tables, fenced code,
 * blockquotes, horizontal rules and inline code/bold/links.
 *
 * Safety: the input is HTML-escaped **before** any transformation, so a
 * document can never inject markup.
 */
import { escapeHtml } from './arabic.js';

/** @param {string} text */
function inline(text) {
  /** @type {string[]} */
  const codeSpans = [];
  let out = escapeHtml(text);

  // Pull inline code out first so its content is not transformed further.
  out = out.replace(/`([^`]+)`/g, (_match, code) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  out = out
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      const safeHref = /^(https?:|mailto:|#|\.\/|\.\.\/)/i.test(href) ? href : '#';
      return `<a href="${safeHref}"${/^https?:/i.test(safeHref) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,؛:]|$)/g, '$1<em>$2</em>');

  return out.replace(/\u0000CODE(\d+)\u0000/g, (_match, index) => `<code>${codeSpans[Number(index)]}</code>`);
}

/** @param {string} row */
function splitTableRow(row) {
  return row
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** @param {string} line */
const isTableSeparator = (line) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

/**
 * @param {string} markdown
 * @returns {string} HTML
 */
export function renderMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  /** @type {string[]} */
  const html = [];
  let index = 0;

  const closeList = () => {
    if (openList) {
      html.push(`</${openList}>`);
      openList = null;
    }
  };
  /** @type {'ul'|'ol'|null} */
  let openList = null;

  while (index < lines.length) {
    const line = lines[index];

    // ------------------------------------------------------------------ code
    if (/^\s*```/.test(line)) {
      closeList();
      const language = line.replace(/^\s*```/, '').trim();
      const body = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<pre class="md-code"${language ? ` data-lang="${escapeHtml(language)}"` : ''}><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // --------------------------------------------------------------- heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    // ------------------------------------------------------------ horizontal
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closeList();
      html.push('<hr />');
      index += 1;
      continue;
    }

    // ---------------------------------------------------------------- table
    if (line.trim().startsWith('|') && isTableSeparator(lines[index + 1] ?? '')) {
      closeList();
      const header = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      html.push('<div class="md-table-wrap"><table class="md-table"><thead><tr>');
      for (const cell of header) html.push(`<th>${inline(cell)}</th>`);
      html.push('</tr></thead><tbody>');
      for (const row of rows) {
        html.push('<tr>');
        for (let cell = 0; cell < header.length; cell += 1) html.push(`<td>${inline(row[cell] ?? '')}</td>`);
        html.push('</tr>');
      }
      html.push('</tbody></table></div>');
      continue;
    }

    // ---------------------------------------------------------------- lists
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (openList !== type) {
        closeList();
        html.push(`<${type}>`);
        openList = type;
      }
      html.push(`<li>${inline((bullet ?? numbered)[1])}</li>`);
      index += 1;
      continue;
    }

    // ----------------------------------------------------------- blockquote
    if (/^\s*>/.test(line)) {
      closeList();
      const body = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
      continue;
    }

    // ---------------------------------------------------------------- blank
    if (!line.trim()) {
      closeList();
      index += 1;
      continue;
    }

    // ------------------------------------------------------------ paragraph
    closeList();
    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|\|)/.test(lines[index]) &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  closeList();
  return html.join('\n');
}
