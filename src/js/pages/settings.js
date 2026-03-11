async function initSettingsPage() {
  const el = document.getElementById('page-settings');
  if (!el) return;

  const darkOn     = await window.db.settings.get('dark_theme').catch(() => false);
  const soundOn    = Sound.isEnabled();
  const fullscreen = await window.db.settings.get('fullscreen_mode').catch(() => false);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Настройки</h1>
    </div>
    <div class="settings-page">

      <div class="settings-section">
        <div class="settings-section-title">Интерфейс</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Тёмная тема</div>
            <div class="settings-row-sub">Переключить цветовую схему</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="set-dark" ${darkOn ? 'checked' : ''}>
            <div class="toggle-track"></div>
          </label>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Полноэкранный режим</div>
            <div class="settings-row-sub">Запускать на весь экран</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="set-fullscreen" ${fullscreen ? 'checked' : ''}>
            <div class="toggle-track"></div>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Звук</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Звуковые эффекты</div>
            <div class="settings-row-sub">Звуки при выполнении упражнений</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="set-sound" ${soundOn ? 'checked' : ''}>
            <div class="toggle-track"></div>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Библиотека</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Экспорт и импорт</div>
            <div class="settings-row-sub">Перенос упражнений, занятий и методик между компьютерами</div>
          </div>
          <div class="settings-btn-row">
            <button class="btn btn-secondary btn-sm" id="set-export">
              <svg viewBox="0 0 20 20" fill="none" width="15" height="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3v10M6 9l4 4 4-4"/><rect x="3" y="14" width="14" height="3" rx="1"/></svg>
              Экспорт
            </button>
            <button class="btn btn-secondary btn-sm" id="set-import">
              <svg viewBox="0 0 20 20" fill="none" width="15" height="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 17V7M6 11l4-4 4 4"/><rect x="3" y="3" width="14" height="3" rx="1"/></svg>
              Импорт
            </button>
          </div>
        </div>
      </div>

    </div>`;

  document.getElementById('set-dark').addEventListener('change', async (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    await window.db.settings.set('dark_theme', e.target.checked).catch(() => {});
  });

  document.getElementById('set-fullscreen').addEventListener('change', async (e) => {
    const mode = e.target.checked ? 'fullscreen' : 'windowed';
    await window.db.window.setMode(mode).catch(() => {});
  });

  document.getElementById('set-sound').addEventListener('change', (e) => {
    Sound.setEnabled(e.target.checked);
    if (e.target.checked) Sound.click();
  });

  document.getElementById('set-export').addEventListener('click', () => exportLibrary());
  document.getElementById('set-import').addEventListener('click', () => importLibrary());
}

Router.register('settings', initSettingsPage);
