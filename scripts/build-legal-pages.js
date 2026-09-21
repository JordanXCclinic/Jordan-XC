#!/usr/bin/env node
// Turns the markdown in docs/ into plain web pages inside the web build, so the
// privacy policy and terms have public addresses. Apple and Google both refuse a
// submission whose privacy policy link does not resolve to a readable page.
//
// Blockquotes are treated as notes to ourselves, not content, and are dropped.
// The policy opens with one telling us to have the clinic's paperwork person
// read it; publishing that to families would be absurd.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'dist');
const DOCS = path.join(__dirname, '..', 'docs');

const PAGES = [
  { md: 'privacy-policy.md', html: 'privacy.html', title: 'Privacy Policy' },
  { md: 'terms.md', html: 'terms.html', title: 'Terms of Use' },
];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Inline markdown, applied after escaping so the source cannot inject HTML.
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bare email and web addresses, so "info@jordanxcclinic.com" is clickable.
    .replace(/\b([\w.+-]+@[\w-]+\.[\w.]+)\b/g, '<a href="mailto:$1">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, '$1<a href="$2">$2</a>');
}

function render(markdown) {
  const out = [];
  let para = [];
  let list = [];

  const flushPara = () => {
    if (para.length) {
      // Markdown folds consecutive lines into one paragraph. That is right for
      // prose, but the documents open with a stack of "**Label:** value" lines
      // that are meant to read as separate lines, so those keep their break.
      const html = para
        .map((line, i) => (i > 0 && line.startsWith('**') ? '<br>' : '') + inline(line))
        .join(' ');
      out.push(`<p>${html}</p>`);
    }
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      out.push('<ul>');
      for (const li of list) out.push(`  <li>${inline(li)}</li>`);
      out.push('</ul>');
    }
    list = [];
  };
  const flush = () => { flushPara(); flushList(); };

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();

    if (line.startsWith('>')) { flush(); continue; }   // internal note
    if (!line.trim()) { flush(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) { flushPara(); list.push(bullet[1]); continue; }

    // A continuation line of the bullet above it, not a new paragraph.
    if (list.length && /^\s+\S/.test(raw)) { list[list.length - 1] += ' ' + line.trim(); continue; }

    flushList();
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

const shell = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Jordan XC Clinic</title>
<style>
  :root { --navy: #003482; --red: #c4303f; --grey: #d9d9d9; --ink: #16191d; --muted: #5a6068; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 20px 80px;
    font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink); background: #fff;
  }
  main { max-width: 42rem; margin: 0 auto; }
  header { background: var(--navy); margin: 0 -20px 40px; padding: 28px 20px; }
  header a { color: #fff; text-decoration: none; font-weight: 700; letter-spacing: .01em; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 1.5rem; color: var(--navy); }
  h2 { font-size: 1.2rem; margin: 2.4rem 0 .6rem; color: var(--navy);
       border-top: 1px solid var(--grey); padding-top: 1.4rem; }
  h1 + p { color: var(--muted); }
  a { color: var(--red); }
  ul { padding-left: 1.2rem; }
  li { margin: .35rem 0; }
  code { background: #f2f3f5; padding: .1em .35em; border-radius: 4px; font-size: .9em; }
  footer { margin-top: 3.5rem; padding-top: 1.4rem; border-top: 1px solid var(--grey);
           color: var(--muted); font-size: .9rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #14161a; color: #e9ecf1; }
    h1, h2 { color: #8fb3ee; }
    h2 { border-top-color: #2a2f37; }
    a { color: #ff8a93; }
    code { background: #22262d; }
    footer { border-top-color: #2a2f37; }
  }
</style>
</head>
<body>
<header><a href="https://jordanxcclinic.com">Jordan Cross Country Clinic</a></header>
<main>
${body}
<footer>Jordan Cross Country Clinic · Birmingham, Alabama ·
<a href="mailto:info@jordanxcclinic.com">info@jordanxcclinic.com</a></footer>
</main>
</body>
</html>
`;

if (!fs.existsSync(OUT)) {
  console.error(`No build found at ${OUT}. Run "expo export --platform web" first.`);
  process.exit(1);
}

for (const page of PAGES) {
  const src = path.join(DOCS, page.md);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}`);
    process.exit(1);
  }
  const html = shell(page.title, render(fs.readFileSync(src, 'utf8')));
  fs.writeFileSync(path.join(OUT, page.html), html);
  console.log(`  ${page.md} -> dist/${page.html}`);
}
