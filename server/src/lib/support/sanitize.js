/**
 * Inbound email HTML is untrusted. It is sanitized once, before it is stored, with an allow-list
 * (tags, attributes, URL schemes). Admin shows the result only inside an iframe with
 * `sandbox` (no scripts, no same-origin) and a CSP of `default-src 'none'` — never as page HTML.
 *
 *   - dropped with their content: script, style, iframe, object, embed, form controls, svg, math,
 *     head/meta/link/base/title, template, noscript, audio/video …
 *   - unknown tags are unwrapped (text kept), comments and conditional comments removed
 *   - every on* handler and every non-listed attribute is removed
 *   - links keep http(s)/mailto only and open in a new tab without referrer
 *   - images: inline data:image/* kept (Resend returns inline parts as data URIs); every remote
 *     image is removed — tracking pixels silently, others replaced by „[სურათი: alt]“ — so opening
 *     a message never tells the sender that it was read or leaks the admin's IP
 *   - style attributes containing url(), expression(), @import, behavior or javascript: are dropped
 */
import * as cheerio from 'cheerio';

export const HTML_MAX_BYTES = 600_000;
export const TEXT_MAX_CHARS = 200_000;

const DROP = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'template',
  'svg', 'math', 'form', 'input', 'button', 'select', 'option', 'textarea', 'link', 'meta', 'base', 'head',
  'title', 'audio', 'video', 'source', 'track', 'canvas', 'portal', 'dialog', 'xml', 'param',
]);
const KEEP = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'p', 'br', 'div', 'span', 'table', 'thead', 'tbody', 'tfoot',
  'tr', 'td', 'th', 'caption', 'col', 'colgroup', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'img', 'font', 'center', 'small', 'big', 'sub', 'sup', 'dl', 'dt', 'dd', 'section',
  'article', 'header', 'footer', 'figure', 'figcaption', 'address', 'abbr', 'cite', 'q', 'mark', 'del', 'ins', 'tt', 'kbd',
]);
const GLOBAL_ATTRS = new Set(['title', 'dir', 'lang', 'align', 'valign', 'width', 'height', 'bgcolor', 'color', 'border',
  'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'style', 'face', 'size']);
const TAG_ATTRS = { a: new Set(['href']), img: new Set(['src', 'alt']) };
const BAD_STYLE = /url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|javascript:|vbscript:|position\s*:\s*(fixed|absolute)/i;
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

/** http(s) and mailto only; control characters and whitespace are removed before the check. */
export function safeHref(value) {
  const url = String(value ?? '').replace(/[\u0000- \u007f-\u009f]/g, '');
  if (/^https?:\/\/[^"'<>]+$/i.test(url)) return url;
  if (/^mailto:[^"'<>]+$/i.test(url)) return url;
  return '';
}

function isTag(node) {
  return node && (node.type === 'tag' || node.type === 'script' || node.type === 'style');
}

function tinyImage(attribs) {
  const n = (v) => Number.parseInt(String(v ?? '').replace(/px$/i, ''), 10);
  const w = n(attribs.width);
  const h = n(attribs.height);
  const style = String(attribs.style || '');
  return (Number.isFinite(w) && w <= 3) || (Number.isFinite(h) && h <= 3) || /(width|height)\s*:\s*[0-3]px/i.test(style) || /display\s*:\s*none/i.test(style);
}

/**
 * @returns {{ html: string|null, blockedImages: number, truncated: boolean }}
 * `html` is null for empty input or when even the image-free version exceeds `maxBytes`.
 */
export function sanitizeEmailHtml(input, { maxBytes = HTML_MAX_BYTES, keepDataImages = true } = {}) {
  const raw = String(input ?? '');
  if (!raw.trim()) return { html: null, blockedImages: 0, truncated: false };
  // Parsing a multi-megabyte body is pointless: nothing that large is kept.
  const source = raw.length > maxBytes * 8 ? raw.slice(0, maxBytes * 8) : raw;
  const $ = cheerio.load(source, null, false);
  let blockedImages = 0;

  const walk = (parent) => {
    for (const node of [...(parent.children || [])]) {
      if (node.type === 'text') continue;
      if (!isTag(node)) { $(node).remove(); continue; }
      const name = String(node.name || '').toLowerCase();
      if (DROP.has(name) || node.type !== 'tag') { $(node).remove(); continue; }
      walk(node);
      if (!KEEP.has(name)) { $(node).replaceWith($(node).contents()); continue; }

      const allowed = TAG_ATTRS[name];
      for (const attr of Object.keys(node.attribs || {})) {
        const key = attr.toLowerCase();
        const value = node.attribs[attr];
        const ok = !key.startsWith('on') && (GLOBAL_ATTRS.has(key) || allowed?.has(key));
        if (!ok) { delete node.attribs[attr]; continue; }
        if (key === 'style' && (BAD_STYLE.test(value) || value.length > 2000)) delete node.attribs[attr];
        if (key === 'href') {
          const href = safeHref(value);
          if (href) node.attribs[attr] = href; else delete node.attribs[attr];
        }
      }
      if (name === 'a' && node.attribs.href) {
        node.attribs.target = '_blank';
        node.attribs.rel = 'noopener noreferrer nofollow';
      }
      if (name === 'img') {
        const src = String(node.attribs.src || '').trim();
        if (keepDataImages && DATA_IMAGE.test(src)) continue;
        blockedImages += 1;
        const alt = String(node.attribs.alt || '').trim().slice(0, 80);
        if (!alt || tinyImage(node.attribs)) $(node).remove();
        else $(node).replaceWith(`<span>[სურათი: ${$('<i>').text(alt).html()}]</span>`);
      }
    }
  };
  walk($.root()[0]);

  const html = $.html().trim();
  if (Buffer.byteLength(html, 'utf8') <= maxBytes) return { html: html || null, blockedImages, truncated: false };
  if (keepDataImages) {
    const smaller = sanitizeEmailHtml(html, { maxBytes, keepDataImages: false });
    return { html: smaller.html, blockedImages: blockedImages + smaller.blockedImages, truncated: true };
  }
  return { html: null, blockedImages, truncated: true };
}

/** Plain text from (already sanitized) HTML — used when a message has no text part. */
export function htmlToText(html, { maxChars = TEXT_MAX_CHARS } = {}) {
  if (!html) return '';
  const $ = cheerio.load(String(html), null, false);
  $('br').replaceWith('\n');
  $('p, div, tr, li, h1, h2, h3, h4, h5, h6, blockquote, pre, table').each((_i, el) => { $(el).append('\n'); });
  return $.root().text().replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxChars);
}

export function capText(text, maxChars = TEXT_MAX_CHARS) {
  if (text == null) return null;
  const s = String(text).replace(/\u0000/g, '');
  return s.length > maxChars ? `${s.slice(0, maxChars)}\n…` : s;
}
