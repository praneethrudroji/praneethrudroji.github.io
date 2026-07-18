---
# Jekyll front matter so Liquid embeds the abbreviation data at build time.
---
/**
 * Hover tooltips for abbreviations in post prose.
 * Terms come from _data/abbreviations.yml. Each match gets a dotted
 * underline, an instant tooltip showing the full form, and a link to the
 * glossary entry (so tapping works on touch screens where hover does not).
 */
(function () {
  'use strict';

  if (!location.pathname.startsWith('/posts/')) return;
  var content = document.querySelector('article .content');
  if (!content) return;

  var TERMS = {{ site.data.abbreviations | jsonify }};
  if (!TERMS || !TERMS.length) return;

  /* Longest first so "EF Core" wins over a hypothetical "EF". */
  TERMS.sort(function (a, b) {
    return b.abbr.length - a.abbr.length;
  });
  var byAbbr = {};
  var pattern = TERMS.map(function (t) {
    byAbbr[t.abbr] = t;
    return t.abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|');
  /* Word-bounded, case-sensitive, optional plural "s". */
  var RE = new RegExp('\\b(' + pattern + ')(s?)\\b', 'g');

  var SKIP = { CODE: 1, PRE: 1, KBD: 1, SCRIPT: 1, STYLE: 1, A: 1, ABBR: 1, BUTTON: 1, SELECT: 1 };

  function skippable(node) {
    for (var el = node.parentElement; el && el !== content; el = el.parentElement) {
      if (SKIP[el.tagName] || el.tagName === 'svg' || el.tagName === 'SVG') return true;
      if (el.classList.contains('mermaid') || el.classList.contains('highlight')) return true;
    }
    return false;
  }

  function wrap(textNode) {
    var text = textNode.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    RE.lastIndex = 0;

    var frag = document.createDocumentFragment();
    var last = 0;
    var m;
    while ((m = RE.exec(text)) !== null) {
      var term = byAbbr[m[1]];
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));

      var a = document.createElement('a');
      a.className = 'abbr-gloss-link';
      a.href = '/glossary/#' + term.anchor;
      var ab = document.createElement('abbr');
      ab.className = 'abbr-gloss';
      ab.setAttribute('data-full', term.full + (m[2] ? 's' : ''));
      ab.setAttribute('aria-label', term.full);
      ab.textContent = m[0];
      a.appendChild(ab);
      frag.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  }

  var CSS =
    '.abbr-gloss{font-style:normal;cursor:help;position:relative;' +
    'text-decoration:underline dotted var(--text-muted-color,gray);text-underline-offset:3px}' +
    '.abbr-gloss-link{color:inherit !important;border-bottom:none !important}' +
    '.abbr-gloss::after{content:attr(data-full);position:absolute;bottom:calc(100% + 8px);left:50%;' +
    'transform:translateX(-50%) translateY(4px);width:max-content;max-width:16rem;' +
    'background:var(--card-bg,#fff);color:var(--text-color,#333);' +
    'border:1px solid var(--btn-border-color,rgba(128,128,128,.3));border-radius:.45rem;' +
    'box-shadow:var(--card-shadow,0 2px 8px rgba(0,0,0,.2));padding:.3rem .6rem;' +
    'font-size:.78rem;line-height:1.35;text-align:center;white-space:normal;' +
    'opacity:0;visibility:hidden;transition:opacity .15s,transform .15s;pointer-events:none;z-index:50}' +
    '.abbr-gloss:hover::after,.abbr-gloss-link:focus .abbr-gloss::after' +
    '{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}';

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
  var nodes = [];
  while (walker.nextNode()) {
    if (!skippable(walker.currentNode)) nodes.push(walker.currentNode);
  }
  nodes.forEach(wrap);
})();
