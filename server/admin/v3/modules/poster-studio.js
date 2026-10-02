/**
 * #/poster-studio — the campaign poster editor (./poster-studio/) runs in a same-origin iframe so its canvas
 * styles stay isolated from the admin shell. The frame fills the workspace, the studio follows the admin
 * theme (data-theme on its <html>), and „პოსტების ტექსტები“ (copybook.md) opens as a readable admin dialog.
 */
(function adminPosterStudio(global) {
  const doc = document;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let themeWatch = null;

  function syncTheme(frame) {
    const html = frame?.contentDocument?.documentElement;
    if (!html) return;
    html.dataset.theme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    html.dataset.embedded = 'admin';
  }

  /** copybook.md uses headings, paragraphs and `file names` only — enough to render it without a parser. */
  function copybookHtml(md) {
    const inline = (text) => esc(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
    const out = [];
    let open = false;
    for (const block of String(md).replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
      const text = block.trim();
      if (!text || /^#\s/.test(text)) continue; // the dialog title already names the document
      const heading = /^##\s+(.+)$/.exec(text);
      if (heading) {
        if (open) out.push('</section>');
        out.push(`<section class="p1-copybook-post"><h4>${inline(heading[1])}</h4>`);
        open = true;
      } else {
        out.push(`<p${open ? '' : ' class="p1-copybook-lead"'}>${inline(text)}</p>`);
      }
    }
    if (open) out.push('</section>');
    return out.join('');
  }

  async function openCopybook() {
    let md;
    try {
      const res = await fetch('./poster-studio/copybook.md', { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      md = await res.text();
    } catch {
      global.toast?.('პოსტების ტექსტები ვერ ჩაიტვირთა. სცადე ხელახლა.', 'bad');
      return;
    }
    global.AdminV3?.openDialog?.({
      title: 'პოსტების ტექსტები',
      description: 'თითო პოსტერის სათაური და ტექსტი სოციალურ ქსელში გამოსაქვეყნებლად.',
      body: `<div class="p1-copybook">${copybookHtml(md)}</div>`,
      wide: true,
      watchDirty: false,
    });
  }

  global.renderPosterStudio = function renderPosterStudio() {
    const root = doc.getElementById('tab-poster-studio');
    if (!root || root.querySelector('iframe')) return;
    const frame = doc.createElement('iframe');
    frame.className = 'p1-studio-frame';
    frame.src = './poster-studio/index.html';
    frame.title = 'MEDICARD — პოსტერების სტუდია';
    frame.addEventListener('load', () => {
      syncTheme(frame);
      frame.contentDocument?.querySelector('a[href="copybook.md"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        void openCopybook();
      });
    });
    root.replaceChildren(frame);
    if (!themeWatch) {
      themeWatch = new MutationObserver(() => syncTheme(doc.querySelector('#tab-poster-studio iframe')));
      themeWatch.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  };
})(window);
