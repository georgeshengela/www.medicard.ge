(() => {
  const input = document.getElementById('admin-module-search');
  const nav = document.querySelector('.sidebar-nav');
  if (!input || !nav) return;
  const empty = document.createElement('p');
  empty.className = 'admin-nav-empty'; empty.hidden = true;
  empty.setAttribute('role', 'status'); empty.textContent = 'მოდული ვერ მოიძებნა'; nav.append(empty);
  const groups = [...nav.querySelectorAll('.v3-nav-group')];
  const original = new Map();
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    let total = 0;
    groups.forEach(group => {
      if (!original.has(group)) original.set(group, group.className);
      let visible = 0;
      group.querySelectorAll('button[data-tab]').forEach(button => {
        button.hidden = !!query && !button.textContent.toLocaleLowerCase().includes(query);
        if (!button.hidden) visible++;
      });
      group.hidden = visible === 0;
      if (query && visible) { group.classList.remove('is-collapsed'); group.querySelector('.v3-nav-group-items').style.display = 'block'; }
      else if (!query) { group.className = original.get(group); group.querySelector('.v3-nav-group-items').style.removeProperty('display'); }
      total += visible;
    });
    empty.hidden = total > 0;
    if (!query) original.clear();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); }
  });
})();
