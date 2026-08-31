/**
 * Test suite for the Roamify Tables conversion engine.
 * Extracts the inline <script> from index.html, executes it in Node
 * with a jsdom-provided DOMParser, then asserts round-trip behavior.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load the real page with jsdom so the full DOM exists and inline JS runs
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const T = dom.window.RoamifyTables;
if (!T) { console.error('FAIL: window.RoamifyTables was not exposed'); process.exit(1); }

let pass = 0, fail = 0;
function assert(cond, name, detail) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.error('FAIL  ' + name + (detail ? '\n      ' + detail : '')); }
}

const htmlSample = `  <table>
    <thead><tr><th>Fruit</th><th>Color</th><th>Price</th></tr></thead>
    <tbody>
      <tr><td>Apple</td><td>Red</td><td>$1.20</td></tr>
      <tr><td>Banana</td><td>Yellow</td><td>$0.60</td></tr>
      <tr><td>Grape</td><td>Purple</td><td>$2.10</td></tr>
    </tbody>
  </table>`;

const mdSample = '| Fruit  | Color  | Price |\n| ------ | ------ | ----- |\n| Apple  | Red    | $1.20 |\n| Banana | Yellow | $0.60 |\n| Grape  | Purple | $2.10 |';

const roamSample = `{{[[table]]}}
    - Fruit
        - Color
        - Price
    - Apple
        - Red
        - $1.20
    - Banana
        - Yellow
        - $0.60
    - Grape
        - Purple
        - $2.10`;

console.log('\n--- HTML -> Roam ---');
const h2r = T.htmlToRoam(htmlSample);
assert(h2r.startsWith('{{[[table]]}}'), 'starts with {{[[table]]}}', h2r.split('\n')[0]);
assert(h2r.includes('    - Fruit'), 'header row present (level 1)');
assert(h2r.includes('        - Color'), 'second cell nested (level 2)');
assert(h2r.includes('        - $2.10'), 'last cell present');
assert((h2r.match(/- /g) || []).length === 12, '12 cells total (3 rows x 3 cols + 1 header = 4 rows x 3 cols)', h2r);

console.log('\n--- Roam -> HTML ---');
const r2h = T.roamToHtml(roamSample);
assert(r2h.startsWith('<table>'), 'starts with <table>');
assert(r2h.includes('<th scope="col">Fruit</th>'), 'first row becomes <th>');
assert(r2h.includes('<td>Apple</td>'), 'body row uses <td>');
assert(r2h.includes('</table>'), 'closes table');
const trCount = (r2h.match(/<tr>/g) || []).length;
assert(trCount === 4, '4 <tr> rows (1 header + 3 body)', String(trCount));

console.log('\n--- Markdown -> Roam ---');
const m2r = T.mdToRoam(mdSample);
assert(m2r.startsWith('{{[[table]]}}'), 'starts with {{[[table]]}}');
assert(m2r.includes('    - Fruit'), 'header row first');
assert(m2r.includes('        - Red'), 'cell nested under row');
assert(!m2r.includes('---'), 'separator row skipped');
assert((m2r.match(/- /g) || []).length === 12, '12 cells', m2r);

console.log('\n--- Roam -> Markdown ---');
const r2m = T.roamToMd(roamSample);
assert(r2m.startsWith('| Fruit'), 'header first line');
assert(r2m.includes('| --- | --- | --- |'), 'separator row present');
assert(r2m.includes('| Grape | Purple | $2.10 |'), 'last row present');
const mdLines = r2m.split('\n');
assert(mdLines.length === 5, '5 lines (4 rows + 1 separator)', String(mdLines.length));

console.log('\n--- Round trips ---');
const rt1 = T.roamToHtml(T.htmlToRoam(htmlSample));
assert(rt1.includes('<td>Apple</td>') && rt1.includes('<th scope="col">Fruit</th>'), 'HTML -> Roam -> HTML keeps all content');
const rt2 = T.roamToMd(T.mdToRoam(mdSample));
assert(rt2.includes('| Apple | Red | $1.20 |'), 'MD -> Roam -> MD keeps all content', rt2);
const rt3 = T.htmlToRoam(T.roamToHtml(roamSample));
assert(rt3.includes('        - Color') && rt3.includes('        - $2.10'), 'Roam -> HTML -> Roam keeps all content', rt3);

console.log('\n--- Edge cases (4 Roam copy variants) ---');
assert(T.roamToRows(roamSample).length === 4, 'roamToRows parses 4 rows');
assert(T.roamToRows(roamSample)[0].length === 3, 'first row has 3 cells');

// Variant 1: list-only copy, no tag, flush-left rows
const v1 = '- 行1列1\n    - 行1列2\n- 行2列1\n    - 行2列2\n- 行3列1\n    - 行3列2';
assert(T.roamToRows(v1).length === 3, 'variant 1 (no tag, flush) parses 3 rows', JSON.stringify(T.roamToRows(v1)));
assert(T.roamToRows(v1)[0].length === 2, 'variant 1 rows have 2 cells');
assert(T.roamToHtml(v1).includes('<th scope="col">行1列1</th>'), 'variant 1 -> HTML works');
assert(T.roamToMd(v1).includes('| 行1列2 |'), 'variant 1 -> Markdown works');

// Variant 2: bullet mode, "- {{[[table]]}}"
const v2 = '- {{[[table]]}}\n    - a\n        - b\n    - c\n        - d';
assert(T.roamToRows(v2).length === 2, 'variant 2 (- {{[[table]]}}) parses 2 rows', JSON.stringify(T.roamToRows(v2)));
assert(T.roamToRows(v2)[0].length === 2, 'variant 2 rows have 2 cells');

// Variant 3: document mode, bare tag (covered by roamSample above)

// Variant 4: numbered mode, "17. {{[[table]]}}"
const v4 = '17. {{[[table]]}}\n    - a\n        - b\n    - c\n        - d';
assert(T.roamToRows(v4).length === 2, 'variant 4 (numbered tag) parses 2 rows', JSON.stringify(T.roamToRows(v4)));
assert(T.roamToRows(v4)[0].length === 2, 'variant 4 rows have 2 cells');
assert(T.roamToHtml(v4).includes('<th scope="col">b</th>') && T.roamToHtml(v4).includes('<td>d</td>'), 'variant 4 -> HTML works');

assert(T.roamToRows('{{table}}\n    - a\n        - b')[0].length === 2, 'accepts {{table}} variant');
assert(T.roamToRows('- {{table}}\n    - a\n        - b')[0].length === 2, 'accepts "- {{table}}" variant');
assert(T.roamToRows('- {{[[table]]}}\n\t- a\n\t\t- b')[0].length === 2, 'tolerates tab indent');
let threw = false;
try { T.htmlToRoam('just some text, no table'); } catch (e) { threw = true; }
assert(threw, 'htmlToRoam throws when no <table> found');
let threw2 = false;
try { T.roamToHtml('plain text without list'); } catch (e) { threw2 = true; }
assert(threw2, 'roamToHtml throws on non-table input');
let threw3 = false;
try { T.mdToRoam('not a markdown table'); } catch (e) { threw3 = true; }
assert(threw3, 'mdToRoam throws on non-table input');

// colspan/rowspan get flattened (no crash, all content kept)
const merged = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td rowspan="2">C</td><td>D</td><td>E</td></tr><tr><td>F</td><td>G</td></tr></table>';
const mergedRoam = T.htmlToRoam(merged);
assert(mergedRoam.split('\n').length === 8, 'merged cells flattened into 7 entries (1 + 7 lines)', mergedRoam);
const mergedBack = T.roamToHtml(mergedRoam);
assert(mergedBack.includes('<th scope="col">A</th>') && mergedBack.includes('<td>G</td>'), 'merged table round-trips all content');

console.log('\n--- UI smoke tests (simulated clicks) ---');
{
  const w = dom.window;
  const $ = (id) => w.document.getElementById(id);

  $('sample-html').click();
  assert($('in-html').value.includes('<table>'), 'Sample fills HTML input');
  $('convert-html').click();
  assert($('out-html').value.includes('{{[[table]]}}'), 'Convert produces Roam output');
  assert($('status-html').textContent.indexOf('rows') !== -1, 'status shows row/col count', $('status-html').textContent);

  $('swap-html').click();
  assert($('html-from').textContent.indexOf('RoamResearch') !== -1, 'Swap flips direction label');
  $('convert-html').click();
  assert($('out-html').value.includes('<table>'), 'Reverse convert produces HTML');

  $('sample-html').click();
  assert($('in-html').value.indexOf('{{[[table]]}}') !== -1, 'Sample in roam2html mode loads Roam sample');
  $('convert-html').click();
  assert($('out-html').value.includes('<table>'), 'Roam sample converts to HTML after swap');

  $('tab-md').click();
  assert($('panel-md').classList.contains('active'), 'Tab switch activates MD panel');
  $('sample-md').click();
  $('convert-md').click();
  assert($('out-md').value.includes('{{[[table]]}}'), 'MD convert works');

  $('clear-md').click();
  assert($('in-md').value === '' && $('out-md').value === '', 'Clear empties both boxes');

  $('clear-html').click();
  $('convert-html').click();
  assert($('status-html').textContent.indexOf('Error') !== -1, 'Empty convert shows error hint', $('status-html').textContent);
}

console.log('\n====================================');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
console.log('====================================');
process.exit(fail > 0 ? 1 : 0);