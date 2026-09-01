/**
 * Test suite for the Roamify site (4 pages).
 * Loads each real HTML page with jsdom (runScripts: 'dangerously'),
 * then asserts on the exposed engines and the DOM:
 *   - tables.html     -> window.RoamifyTables    (table converters)
 *   - highlights.html -> window.RoamifyHighlights (highlight converters)
 *   - body.html       -> window.RoamifyBody      (blockquote stripper)
 *   - index.html      -> homepage structure, nav, SEO
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadPage(file) {
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
  return new JSDOM(html, { url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
}

let pass = 0, fail = 0;
function assert(cond, name, detail) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.error('FAIL  ' + name + (detail ? '\n      ' + detail : '')); }
}

/* ================================================================
 * 1) tables.html — RoamifyTables engine (same suite as v1.1.0)
 * ================================================================ */
console.log('\n=== tables.html: RoamifyTables engine ===');
const domTables = loadPage('tables.html');
const T = domTables.window.RoamifyTables;
if (!T) { console.error('FAIL: window.RoamifyTables was not exposed'); process.exit(1); }

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
assert((h2r.match(/- /g) || []).length === 12, '12 cells total (4 rows x 3 cols)', h2r);

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

const v1 = '- 行1列1\n    - 行1列2\n- 行2列1\n    - 行2列2\n- 行3列1\n    - 行3列2';
assert(T.roamToRows(v1).length === 3, 'variant 1 (no tag, flush) parses 3 rows', JSON.stringify(T.roamToRows(v1)));
assert(T.roamToRows(v1)[0].length === 2, 'variant 1 rows have 2 cells');
assert(T.roamToHtml(v1).includes('<th scope="col">行1列1</th>'), 'variant 1 -> HTML works');
assert(T.roamToMd(v1).includes('| 行1列2 |'), 'variant 1 -> Markdown works');

const v2 = '- {{[[table]]}}\n    - a\n        - b\n    - c\n        - d';
assert(T.roamToRows(v2).length === 2, 'variant 2 (- {{[[table]]}}) parses 2 rows', JSON.stringify(T.roamToRows(v2)));
assert(T.roamToRows(v2)[0].length === 2, 'variant 2 rows have 2 cells');

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

const merged = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td rowspan="2">C</td><td>D</td><td>E</td></tr><tr><td>F</td><td>G</td></tr></table>';
const mergedRoam = T.htmlToRoam(merged);
assert(mergedRoam.split('\n').length === 8, 'merged cells flattened into 7 entries (1 + 7 lines)', mergedRoam);
const mergedBack = T.roamToHtml(mergedRoam);
assert(mergedBack.includes('<th scope="col">A</th>') && mergedBack.includes('<td>G</td>'), 'merged table round-trips all content');

console.log('\n--- tables.html UI smoke tests (simulated clicks) ---');
{
  const w = domTables.window;
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

/* ================================================================
 * 2) highlights.html — RoamifyHighlights engine
 * ================================================================ */
console.log('\n=== highlights.html: RoamifyHighlights engine ===');
const domHl = loadPage('highlights.html');
const H = domHl.window.RoamifyHighlights;
if (!H) { console.error('FAIL: window.RoamifyHighlights was not exposed'); process.exit(1); }

console.log('\n--- Markdown -> Roam ---');
assert(H.mdToRoamHighlight('This is a ==highlighted== word.') === 'This is a ^^highlighted^^ word.', 'single marker converts ==x== -> ^^x^^');
const mdNote = 'Meeting ==notes== for ==today==: buy milk, finish the report.';
const md2r = H.mdToRoamHighlight(mdNote);
assert(md2r === 'Meeting ^^notes^^ for ^^today^^: buy milk, finish the report.', 'multiple markers all convert, context kept', md2r);
assert(!md2r.includes('=='), 'no == markers remain after md->roam', md2r);

console.log('\n--- Roam -> Markdown ---');
assert(H.roamToMdHighlight('This is a ^^highlighted^^ word.') === 'This is a ==highlighted== word.', 'single marker converts ^^x^^ -> ==x==');
const roamNote = 'Roam ^^bullets^^ keep the rest of the ^^sentence^^ intact.';
const r2m2 = H.roamToMdHighlight(roamNote);
assert(r2m2 === 'Roam ==bullets== keep the rest of the ==sentence== intact.', 'multiple markers all convert, context kept', r2m2);
assert(!r2m2.includes('^^'), 'no ^^ markers remain after roam->md', r2m2);

console.log('\n--- Edge cases ---');
assert(H.mdToRoamHighlight('plain text with no markers') === 'plain text with no markers', 'no markers -> unchanged');
assert(H.roamToMdHighlight('plain text with no markers') === 'plain text with no markers', 'no markers (roam) -> unchanged');
assert(H.mdToRoamHighlight('a == lone opener stays') === 'a == lone opener stays', 'unpaired == left as-is');
assert(H.roamToMdHighlight('a ^^ lone opener stays') === 'a ^^ lone opener stays', 'unpaired ^^ left as-is');
assert(H.mdToRoamHighlight('') === '', 'empty string -> empty');
assert(H.roamToMdHighlight('') === '', 'empty string (roam) -> empty');
assert(H.mdToRoamHighlight('multiline\n==a==\n==b==') === 'multiline\n^^a^^\n^^b^^', 'multiline text handled');

console.log('\n--- Round trips ---');
const hlRt1 = H.mdToRoamHighlight(H.roamToMdHighlight('^^one^^ and ^^two^^'));
assert(hlRt1 === '^^one^^ and ^^two^^', 'roam -> md -> roam round trip stable', hlRt1);
const hlRt2 = H.roamToMdHighlight(H.mdToRoamHighlight('==one== and ==two=='));
assert(hlRt2 === '==one== and ==two==', 'md -> roam -> md round trip stable', hlRt2);

console.log('\n--- highlights.html UI smoke tests ---');
{
  const w = domHl.window;
  const $ = (id) => w.document.getElementById(id);

  $('sample-hl').click();
  assert($('in-hl').value.includes('=='), 'Sample fills input with Markdown markers');
  $('convert-hl').click();
  assert($('out-hl').value.includes('^^'), 'Convert produces Roam markers', $('out-hl').value);
  assert($('status-hl').textContent.indexOf('highlights converted') !== -1, 'status reports converted count', $('status-hl').textContent);

  $('swap-hl').click();
  assert($('hl-from').textContent.indexOf('RoamResearch') !== -1, 'Swap flips direction label');
  $('convert-hl').click();
  assert($('out-hl').value.includes('=='), 'Reverse convert produces Markdown markers');

  $('clear-hl').click();
  assert($('in-hl').value === '' && $('out-hl').value === '', 'Clear empties both boxes');

  $('convert-hl').click();
  assert($('status-hl').textContent.indexOf('no highlights') !== -1, 'Empty convert shows friendly hint', $('status-hl').textContent);
}

/* ================================================================
 * 3) body.html — RoamifyBody engine
 * ================================================================ */
console.log('\n=== body.html: RoamifyBody engine ===');
const domBody = loadPage('body.html');
const B = domBody.window.RoamifyBody;
if (!B) { console.error('FAIL: window.RoamifyBody was not exposed'); process.exit(1); }

console.log('\n--- Bullet mode ---');
const bulletSample = '- Body paragraph 1\n    - > Supporting citation for paragraph 1\n- Body paragraph 2\n    - > #Phase 1 Target customers, requirements\n- Body paragraph 3\n    - > Single-line citation\n    - > Multi-line citation: first line\n      > Multi-line citation: second line';
const bClean = B.stripQuotes(bulletSample);
assert(bClean === '- Body paragraph 1\n- Body paragraph 2\n- Body paragraph 3', 'bullet quotes removed, bullets kept', JSON.stringify(bClean));
assert(bClean.indexOf('>') === -1, 'no > remains after bullet strip');
assert(B.detectMode(bulletSample) === 'Bullet', 'detects Bullet mode');
assert(B.countQuotes(bulletSample) === 5, 'countQuotes counts all 5 quote lines', String(B.countQuotes(bulletSample)));

console.log('\n--- Document mode ---');
const docSample = 'Body paragraph 1\n    - > Supporting citation for paragraph 1\n\nBody paragraph 2\n    - > Single-line citation\n    - > Multi-line citation: first line\n      > Multi-line citation: second line\n\n\nBody paragraph 3';
const dClean = B.stripQuotes(docSample);
assert(dClean === 'Body paragraph 1\n\nBody paragraph 2\n\nBody paragraph 3', 'document quotes removed, blank runs collapsed to one', JSON.stringify(dClean));
assert(dClean.indexOf('>') === -1, 'no > remains after document strip');
assert(B.detectMode(docSample) === 'Document', 'detects Document mode');

console.log('\n--- Numbered mode ---');
const numSample = '6. Body paragraph 1\n    - > Supporting citation for paragraph 1\n7. Body paragraph 2\n    - > Multi-line citation: first line\n      > Multi-line citation: second line\n8. Body paragraph 3';
const nClean = B.stripQuotes(numSample);
assert(nClean === '6. Body paragraph 1\n7. Body paragraph 2\n8. Body paragraph 3', 'numbered quotes removed, numbers kept', JSON.stringify(nClean));
assert(nClean.indexOf('>') === -1, 'no > remains after numbered strip');
assert(B.detectMode(numSample) === 'Number', 'detects Number mode');

console.log('\n--- Edge cases ---');
assert(B.stripQuotes('plain text with no quotes') === 'plain text with no quotes', 'no quotes -> unchanged');
assert(B.stripQuotes('') === '', 'empty string -> empty');
assert(B.stripQuotes('a\n\n\n\nb') === 'a\n\nb', 'blank runs collapsed to one');
assert(B.stripQuotes('    > quote') === '', 'bare indented quote removed');
assert(B.detectMode('no structure here') === 'Document', 'plain text detected as Document');
assert(B.detectMode('') === 'Unknown', 'empty input detected as Unknown');

console.log('\n--- stripPrefixes (Keep bullets & numbers off) ---');
assert(B.stripPrefixes('- a\n    - nested\n6. b\nplain') === 'a\n    - nested\nb\nplain', 'strips only top-level markers, nested bullets kept', JSON.stringify(B.stripPrefixes('- a\n    - nested\n6. b\nplain')));
assert(B.stripPrefixes('    - nested') === '    - nested', 'nested bullet fully preserved');
assert(B.stripPrefixes('plain') === 'plain', 'plain lines untouched');
assert(B.stripPrefixes('') === '', 'empty unchanged');
assert(B.stripPrefixes('-1 not a bullet') === '-1 not a bullet', 'dash-number text untouched');
assert(B.stripPrefixes('6.5 not a number') === '6.5 not a number', 'decimal text untouched');

console.log('\n--- body.html UI smoke tests ---');
{
  const w = domBody.window;
  const $ = (id) => w.document.getElementById(id);

  $('sample-body').click();
  assert($('in-body').value.indexOf('>') !== -1, 'Sample fills input with quotes');
  $('convert-body').click();
  assert($('out-body').value.indexOf('>') === -1, 'Convert strips all quotes', $('out-body').value);
  assert($('status-body').textContent.indexOf('removed') !== -1, 'status reports removed count', $('status-body').textContent);

  $('clear-body').click();
  assert($('in-body').value === '' && $('out-body').value === '', 'Clear empties both boxes');

  $('convert-body').click();
  assert($('status-body').textContent.indexOf('no blockquotes') !== -1, 'Empty convert shows friendly hint', $('status-body').textContent);

  /* "Keep bullets & numbers" option */
  $('in-body').value = '- First\n    - Nested\n6. Second';
  $('keep-markers-body').checked = false;
  $('convert-body').click();
  assert($('out-body').value === 'First\n    - Nested\nSecond', 'Unchecked option strips top-level markers, nested kept', JSON.stringify($('out-body').value));
  assert($('status-body').textContent.indexOf('bullets & numbers removed') !== -1, 'status notes markers removed', $('status-body').textContent);
  $('keep-markers-body').checked = true;
  $('convert-body').click();
  assert($('out-body').value === '- First\n    - Nested\n6. Second', 'Checked option keeps bullets & numbers', JSON.stringify($('out-body').value));
}

/* ================================================================
 * 4) index.html — homepage structure, nav, SEO
 * ================================================================ */
console.log('\n=== index.html: homepage ===');
const domHome = loadPage('index.html');
const homeW = domHome.window;
const h$ = (id) => homeW.document.getElementById(id);

console.log('\n--- SEO ---');
assert(domHome.window.document.title.indexOf('Roamify') !== -1, 'title mentions Roamify', domHome.window.document.title);
assert(domHome.window.document.querySelector('meta[name="description"]').content.length > 40, 'meta description present');
assert(domHome.window.document.querySelector('link[rel="canonical"]').getAttribute('href') === 'https://roamify.douzong.top/', 'canonical points to homepage', domHome.window.document.querySelector('link[rel="canonical"]').getAttribute('href'));
assert(domHome.window.document.querySelector('script[type="application/ld+json"]'), 'JSON-LD structured data present');
assert(domHome.window.document.documentElement.innerHTML.indexOf('G-3C28SP2D8F') !== -1, 'GA tag present on homepage');

console.log('\n--- Navigation ---');
const homeNav = homeW.document.querySelectorAll('.nav-links a');
assert(homeNav.length === 4, 'nav has 4 links', String(homeNav.length));
assert(homeW.document.querySelector('.nav-links a.active') !== null, 'Home link marked active');

console.log('\n--- Tool cards ---');
const cards = homeW.document.querySelectorAll('.tool-card');
assert(cards.length === 3, 'three tool cards', String(cards.length));
assert(cards[0].getAttribute('href') === 'tables.html', 'first card links to tables.html', cards[0].getAttribute('href'));
assert(cards[1].getAttribute('href') === 'highlights.html', 'second card links to highlights.html', cards[1].getAttribute('href'));
assert(cards[2].getAttribute('href') === 'body.html', 'third card links to body.html', cards[2].getAttribute('href'));
assert(cards[0].textContent.indexOf('Tables') !== -1, 'first card mentions Tables');
assert(cards[1].textContent.indexOf('Highlights') !== -1, 'second card mentions Highlights');
assert(cards[2].textContent.indexOf('Body') !== -1, 'third card mentions Body');
assert(homeW.document.querySelector('#about h2') !== null, 'What is Roamify section present');
assert(homeW.document.querySelectorAll('#faq details').length >= 3, 'FAQ has 3+ questions');

/* ================================================================
 * 5) Cross-page navigation
 * ================================================================ */
console.log('\n=== cross-page links ===');
const linksOf = (file) => {
  const dom = loadPage(file);
  return Array.from(dom.window.document.querySelectorAll('a')).map(a => a.getAttribute('href'));
};
const tLinks = linksOf('tables.html');
const hLinks = linksOf('highlights.html');
const bLinks = linksOf('body.html');
const iLinks = linksOf('index.html');
assert(tLinks.indexOf('highlights.html') !== -1, 'tables.html links to highlights.html');
assert(tLinks.indexOf('body.html') !== -1, 'tables.html links to body.html');
assert(tLinks.indexOf('index.html') !== -1, 'tables.html links to homepage');
assert(hLinks.indexOf('tables.html') !== -1, 'highlights.html links to tables.html');
assert(hLinks.indexOf('body.html') !== -1, 'highlights.html links to body.html');
assert(hLinks.indexOf('index.html') !== -1, 'highlights.html links to homepage');
assert(bLinks.indexOf('tables.html') !== -1, 'body.html links to tables.html');
assert(bLinks.indexOf('highlights.html') !== -1, 'body.html links to highlights.html');
assert(bLinks.indexOf('index.html') !== -1, 'body.html links to homepage');
assert(iLinks.indexOf('tables.html') !== -1, 'homepage links to tables.html');
assert(iLinks.indexOf('highlights.html') !== -1, 'homepage links to highlights.html');
assert(iLinks.indexOf('body.html') !== -1, 'homepage links to body.html');
assert(tLinks.indexOf('index.html') !== -1 && tLinks.indexOf('highlights.html') !== -1, 'tables.html nav brand + Home present');

console.log('\n====================================');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
console.log('====================================');
process.exit(fail > 0 ? 1 : 0);
