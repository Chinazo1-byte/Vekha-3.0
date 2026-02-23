// ── Роутер ────────────────────────────────────────────────────────────────────
const Router = {
  _pages: {},
  _current: null,

  register(name, loader) {
    this._pages[name] = loader;
  },

  async go(name) {
    if (this._current === name) return;
    this._current = name;

    // Обновить навигацию
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.page === name);
    });

    // Переключить страницы
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${name}`);
    });

    // Загрузить данные страницы
    const loader = this._pages[name];
    if (loader) await loader();
  },
};

// Навигация по клику
document.querySelectorAll('.nav-item').forEach(a => {
  a.addEventListener('click', () => Router.go(a.dataset.page));
});
