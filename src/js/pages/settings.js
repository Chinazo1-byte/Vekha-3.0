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

      <div class="settings-section">
        <div class="settings-section-title">О программе</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Версия приложения</div>
            <div class="settings-row-sub" id="set-version">…</div>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Обновления</div>
            <div class="settings-row-sub" id="set-update-status">Проверьте наличие новой версии</div>
          </div>
          <div class="settings-btn-row">
            <button class="btn btn-secondary btn-sm" id="set-check-update">Проверить</button>
            <button class="btn btn-primary btn-sm" id="set-install-update" style="display:none">Установить</button>
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

  // ── Версия и обновления ───────────────────────────────────────────────────
  window.db.app.version().then(v => {
    const el = document.getElementById('set-version');
    if (el) el.textContent = `Веха v${v}`;
  }).catch(() => {});

  const statusEl  = document.getElementById('set-update-status');
  const checkBtn  = document.getElementById('set-check-update');
  const installBtn = document.getElementById('set-install-update');

  function setStatus(text, busy = false) {
    if (statusEl) statusEl.textContent = text;
    if (checkBtn) checkBtn.disabled = busy;
  }

  // Подписываемся на события от main process (один раз при инициализации страницы)
  window.db.updater.onAvailable(({ version }) => {
    setStatus(`Доступна версия ${version} — нажмите «Скачать»`);
    if (checkBtn)   { checkBtn.textContent = 'Скачать'; checkBtn.disabled = false; checkBtn.onclick = () => { setStatus('Скачиваю…', true); window.db.updater.download(); }; }
  });
  window.db.updater.onNotAvailable(() => {
    setStatus('Установлена последняя версия ✓');
    if (checkBtn) { checkBtn.textContent = 'Проверить'; checkBtn.disabled = false; }
  });
  window.db.updater.onProgress(pct => {
    setStatus(`Скачиваю… ${pct}%`, true);
  });
  window.db.updater.onDownloaded(() => {
    setStatus('Обновление готово — перезапустите приложение');
    if (checkBtn)    checkBtn.style.display = 'none';
    if (installBtn) { installBtn.style.display = ''; installBtn.onclick = () => window.db.updater.install(); }
  });
  window.db.updater.onError(msg => {
    if (msg === 'unavailable') {
      setStatus('Обновления доступны только в установленной версии');
    } else {
      setStatus('Ошибка проверки обновлений');
      console.warn('[updater]', msg);
    }
    if (checkBtn) { checkBtn.textContent = 'Повторить'; checkBtn.disabled = false; }
  });

  checkBtn?.addEventListener('click', () => {
    setStatus('Проверяю…', true);
    window.db.updater.check();
  });
}

Router.register('settings', initSettingsPage);
