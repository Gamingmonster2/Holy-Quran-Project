import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEFAULT_DOC_ID, DOCS, docIdFromSearch, findDoc } from '../src/docs-viewer.js';
import { assertEqual, assertTrue, test } from './harness.mjs';

test('every whitelisted document has a unique id and a title', () => {
  const ids = DOCS.map((doc) => doc.id);
  assertEqual(new Set(ids).size, ids.length, 'document ids must be unique');
  for (const doc of DOCS) {
    assertTrue(Boolean(doc.title), `${doc.id} has no title`);
    assertEqual(doc.path.startsWith('./'), true, `${doc.id} must use a relative path`);
  }
});

test('every whitelisted document actually exists on disk', () => {
  for (const doc of DOCS) {
    const path = fileURLToPath(new URL(doc.path.replace(/^\.\//, ''), new URL('../', import.meta.url)));
    assertTrue(existsSync(path), `${doc.path} does not exist`);
  }
});

test('the default document is the first entry and is resolvable', () => {
  assertEqual(DEFAULT_DOC_ID, DOCS[0].id);
  assertEqual(findDoc(DEFAULT_DOC_ID)?.id, DEFAULT_DOC_ID);
});

test('an unknown document id resolves to null instead of throwing', () => {
  assertEqual(findDoc('../../etc/passwd'), null);
  assertEqual(findDoc(''), null);
});

test('the document id is read from the query string with a safe default', () => {
  assertEqual(docIdFromSearch('?f=TESTING.md'), 'TESTING.md');
  assertEqual(docIdFromSearch('?f=TESTING.md&x=1'), 'TESTING.md');
  assertEqual(docIdFromSearch(''), DEFAULT_DOC_ID);
  assertEqual(docIdFromSearch('?other=1'), DEFAULT_DOC_ID);
});
