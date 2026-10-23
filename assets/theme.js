// Light/dark toggle; the choice is remembered per browser
(() => {
  const root = document.documentElement;
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

  const render = () => {
    const dark = current() === 'dark';
    btn.querySelector('.theme-icon').textContent = dark ? '☀' : '☾';
    btn.querySelector('.theme-label').textContent = dark ? '라이트 모드' : '다크 모드';
  };

  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    render();
  });
  systemDark.addEventListener('change', render);
  render();
})();
