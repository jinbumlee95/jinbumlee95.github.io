// Code colouring for the "PG로 LLM 만들기" notes.
// 1) SQL syntax colours inside <pre><code>.
// 2) The same variable (q, k, v, W_o families) gets the same colour everywhere:
//    code blocks, inline <code>, and plain prose, so it can be followed by eye.
(() => {
  const article = document.querySelector('.post article');
  if (!article) return;

  // Variable families. Order matters: longer, more specific names first.
  const FAMILIES = [
    { cls: 'v-q', names: ['w_q1b', 'w_q1', 'w_q2', 'W_q2', 'W_q', 'wq_bak', 'wq', 'qs', 'dq', 'q', 'Query'] },
    { cls: 'v-k', names: ['w_k1', 'w_k2', 'W_k2', 'W_k', 'wk_bak', 'wk', 'ks', 'dk', 'k', 'Key'] },
    { cls: 'v-v', names: ['w_v1', 'w_v2', 'W_v', 'vs', 'v', 'Value'] },
    { cls: 'v-o', names: ['w_o1', 'w_o2', 'W_o'] },
  ];
  // In SQL, a bare `v` is usually the "value" column of a weight table, not Value.
  const SQL_SKIP = new Set(['v']);
  const familyOf = new Map();
  FAMILIES.forEach((f) => f.names.forEach((n) => familyOf.set(n, f.cls)));

  const KEYWORDS = new Set(('select from where group by order join on as with recursive union all and or not in is null ' +
    'case when then else end create replace function returns language sql immutable stable volatile table insert into values ' +
    'update set delete drop if exists limit desc asc distinct lateral cross between declare begin loop for perform do return ' +
    'returning plpgsql int float8 text numeric serial primary key filter').split(' '));

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;

  const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\$\$|\$fn\$)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;

  function highlight(src, { sql = true } = {}) {
    let out = '';
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      const [tok, com, str, dollar, num, word] = m;
      if (com) out += span('c-com', com);
      else if (str) out += span('c-str', str);
      else if (dollar) out += span('c-kw', dollar);
      else if (num) out += span('c-num', num);
      else if (word) {
        const fam = familyOf.get(word);
        const next = src.slice(TOKEN.lastIndex).match(/^\s*\(/);
        if (fam && !(sql && SQL_SKIP.has(word))) out += span(`var ${fam}`, word);
        else if (KEYWORDS.has(word.toLowerCase()) && /[A-Z]/.test(word[0])) out += span('c-kw', word);
        else if (next) out += span('c-fn', word);
        else out += esc(word);
      } else out += esc(tok);
    }
    return out;
  }

  // Code blocks: full SQL colouring. Plain-text diagrams (no SQL keyword) get variables only.
  article.querySelectorAll('pre > code').forEach((code) => {
    const src = code.textContent;
    const isSql = /\b(SELECT|CREATE|UPDATE|WITH|FROM|DROP|INSERT)\b/.test(src);
    code.innerHTML = isSql ? highlight(src) : highlight(src, { sql: false })
      // keep diagram text calm: only variables keep their colour
      .replace(/<span class="c-(?:num|fn|kw|str)">([^<]*)<\/span>/g, '$1');
    code.parentElement.classList.add(isSql ? 'code-sql' : 'code-text');
  });

  // Inline code: colour variables and function names inside it
  article.querySelectorAll(':not(pre) > code').forEach((code) => {
    if (code.closest('.fig, .series, .toc')) return;
    const src = code.textContent;
    const fam = familyOf.get(src);
    if (fam && !(src === 'v')) { code.classList.add('var', fam); return; }
    code.innerHTML = highlight(src).replace(/<span class="c-(?:num|kw|str|com)">([^<]*)<\/span>/g, '$1');
  });

  // Prose: wrap bare variable names (q, k, v, W_q, w_k2 …) in coloured spans
  const PROSE = /(?<![A-Za-z0-9_])(w_[qkvo][12]b?|W_[qkvo]2?|[qkv]|Query|Key|Value)(?![A-Za-z0-9_])/g;
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('pre, code, .fig, .series, .toc, script, style, a, h1, .post-meta')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const HAS = new RegExp(PROSE.source); // non-global copy: .test() on a /g regex keeps state
  const nodes = [];
  while (walker.nextNode()) if (HAS.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const html = esc(n.nodeValue).replace(PROSE, (w) => {
      const fam = familyOf.get(w);
      return fam ? span(`var ${fam}`, w) : w;
    });
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    n.replaceWith(tpl.content);
  });

  // Colour key, shown once under the header when the page uses these variables
  if (article.querySelector('.var')) {
    const key = document.createElement('p');
    key.className = 'var-key';
    key.innerHTML = '색으로 따라 읽기: ' +
      '<span class="var v-q">q · W_q</span> 질문 ' +
      '<span class="var v-k">k · W_k</span> 이름표 ' +
      '<span class="var v-v">v · W_v</span> 내용물 ' +
      '<span class="var v-o">W_o</span> 적을 자리';
    article.querySelector('.post-head')?.append(key);
  }
})();
