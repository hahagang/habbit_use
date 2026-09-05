import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Captured before the visual redesign. Ignoring only className allows layout and
// styling changes while detecting any altered copy, event handlers, storage,
// accessibility attributes, validation, or completion/date logic.
test('visual redesign preserves original copy and interaction implementation', () => {
  const source = ts.createSourceFile('page.tsx',
    readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = ts.transform(source, [(context) => (root) =>
    ts.visitNode(root, function visit(node) {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'className') {
        return undefined;
      }
      return ts.visitEachChild(node, visit, context);
    })]);
  try {
    const fingerprint = createHash('sha256')
      .update(ts.createPrinter().printFile(result.transformed[0])).digest('hex');
    assert.equal(fingerprint,
      '2cf69ad9b6c1083a145941aaa5213597ad131503443d0e1d2f8ec287b25e1faa',
      'A change outside className requires an explicit functional/copy review.');
  } finally {
    result.dispose();
  }
});
