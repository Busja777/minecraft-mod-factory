import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, shotCardHtml } from '../tools/serie/shot-card.js';

test('fitScale: small chat lines grow, but at most twice', () => {
  assert.equal(fitScale([[450, 60]]), 2);
});

test('fitScale: a full screenshot shrinks into the card', () => {
  const s = fitScale([[1680, 1050]]);
  assert.ok(s < 1);
  assert.ok(1680 * s <= 1160 && 1050 * s <= 540);
});

test('fitScale: side by side and stacked keep all crops inside the card', () => {
  const sizes = [[251, 194], [402, 296]];
  const row = fitScale(sizes);
  assert.ok((251 + 402) * row + 28 <= 1160 + 1e-9 && 296 * row <= 540 + 1e-9);
  const col = fitScale(sizes, true);
  assert.ok((194 + 296) * col + 28 <= 540 + 1e-9 && 402 * col <= 1160 + 1e-9);
});

test('shotCardHtml: caption escaped, images at their final size, says it is from the game', () => {
  const html = shotCardHtml({ reihe: 'wow', caption: 'Gold <and> more', images: [{ uri: 'data:x', width: 300, height: 200 }] });
  assert.match(html, /Gold &lt;and&gt; more/);
  assert.match(html, /width="300" height="200"/);
  assert.match(html, /In-game screenshot/);
});

test('shotCardHtml: refuses a card without caption or image', () => {
  assert.throws(() => shotCardHtml({ reihe: 'wow', caption: '', images: [{ uri: 'x', width: 1, height: 1 }] }));
  assert.throws(() => shotCardHtml({ reihe: 'wow', caption: 'x', images: [] }));
  assert.throws(() => fitScale([]));
});
