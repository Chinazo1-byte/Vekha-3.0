// ══════════════════════════════════════════════════════════════════════════════
//  ВЕХА — инициализация приложения
// ══════════════════════════════════════════════════════════════════════════════

// ── Сплэш-экран ───────────────────────────────────────────────────────────────
function initSplash() {
  const splash = document.getElementById('splash-screen');
  const video  = document.getElementById('splash-video');
  const app    = document.getElementById('app');
  if (!splash || !video) { if(app) app.style.display = ''; return; }

  function hideSplash() {
    if (splash._done) return;
    splash._done = true;
    document.removeEventListener('keydown', onKey);
    splash.classList.add('fade-out');
    if(app) app.style.display = '';
    setTimeout(() => splash.remove(), 600);
  }

  function onKey(e) {
    if (e.code === 'Space') { e.preventDefault(); hideSplash(); }
  }

  document.addEventListener('keydown', onKey);
  video.addEventListener('ended', hideSplash);
  setTimeout(hideSplash, 9000);
  video.play().catch(() => hideSplash());
}

// ── Тёмная тема ───────────────────────────────────────────────────────────────
async function initDarkTheme() {
  const isDark = await window.db.settings.get('dark_theme').catch(() => false);
  if (isDark) document.body.classList.add('dark');
}

// ── Тайтлбар ──────────────────────────────────────────────────────────────────
async function initTitlebar() {
  if (!window.db?.window) return;

  // Применить начальный режим
  const isFullscreen = await window.db.settings.get('fullscreen_mode').catch(() => false);
  if (!isFullscreen) document.body.classList.add('windowed');

  window.db.window.onMode(mode => {
    document.body.classList.toggle('windowed', mode === 'windowed');
  });

  window.db.window.onState(state => {
    const icon = document.querySelector('#tb-maximize svg');
    if (!icon) return;
    icon.innerHTML = state.maximized
      ? '<path d="M3 7h7v7H3zM7 3h7v7H7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>'
      : '<rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>';
  });

  document.getElementById('tb-minimize')?.addEventListener('click', () => window.db.window.minimize());
  document.getElementById('tb-maximize')?.addEventListener('click', () => window.db.window.maximize());
  document.getElementById('tb-close')?.addEventListener('click',    () => window.db.window.close());
}

// ── Инициализация приложения ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initDarkTheme();
  initSplash();
  await Router.go('students');
  initQuitButton();
  initTitlebar();
});

// ── Кнопка выхода ─────────────────────────────────────────────────────────────
function initQuitButton() {
  document.getElementById('btn-quit')?.addEventListener('click', () => {
    Modal.confirm(
      'Выйти из программы?',
      'Все данные сохранены. Вы уверены, что хотите закрыть Веху?',
      () => window.db.app.quit(), 'Выйти', false
    );
  });
}

// ── Экспорт / импорт библиотеки ───────────────────────────────────────────────
async function exportLibrary() {
  try {
    const exercises   = await window.db.exercises.getAll();
    const sessions    = await window.db.sessions.getAll();
    const diagnostics = (await window.db.diagnostics.getAll()).filter(d => !d.is_builtin);

    const exWithContent   = await Promise.all(exercises.map(ex => window.db.exercises.get(ex.id)));
    const diagWithContent = await Promise.all(diagnostics.map(d => window.db.diagnostics.get(d.id)));

    const payload = {
      version:     '1.0',
      app:         'Веха',
      exported:    new Date().toISOString(),
      exercises:   exWithContent,
      sessions:    sessions,
      diagnostics: diagWithContent,
    };

    const result = await window.db.library.export(payload);
    if (result.canceled) return;
    if (result.ok) toast(`Экспортировано: ${exWithContent.length} упражнений, ${sessions.length} занятий, ${diagWithContent.length} диагностик`, 'success');
  } catch(e) {
    toast('Ошибка экспорта: ' + e.message, 'error');
  }
}

async function importLibrary() {
  const result = await window.db.library.import();
  if (result.canceled) return;
  if (result.error) { toast(result.error, 'error'); return; }

  const { data } = result;
  if (!data || data.app !== 'Веха') {
    toast('Файл не распознан как библиотека Вехи', 'error');
    return;
  }

  const exCount   = (data.exercises   || []).length;
  const sesCount  = (data.sessions    || []).length;
  const diagCount = (data.diagnostics || []).length;

  Modal.confirm(
    'Импортировать библиотеку?',
    `Будет добавлено: <b>${exCount}</b> упражнений, <b>${sesCount}</b> занятий, <b>${diagCount}</b> диагностик.<br>
     <small style="color:var(--text-3)">Существующие данные не удаляются — импорт добавляется поверх.</small>`,
    async () => {
      try {
        let addedEx = 0, addedSes = 0, addedDiag = 0;
        const idMap = {};

        for (const ex of (data.exercises || [])) {
          const oldId   = ex.id;
          const created = await window.db.exercises.create({
            name:       ex.name + ' (импорт)',
            type:       ex.type,
            difficulty: ex.difficulty || 'medium',
            content:    ex.content || '{}',
          });
          idMap[oldId] = created.id;
          addedEx++;
        }

        for (const ses of (data.sessions || [])) {
          let exIds = [];
          try { exIds = JSON.parse(ses.exercise_ids || '[]'); } catch(e) {}
          const mapped = exIds.map(id => idMap[id] ?? id);
          await window.db.sessions.create({
            name:         ses.name + ' (импорт)',
            exercise_ids: JSON.stringify(mapped),
            notes:        ses.notes || '',
          });
          addedSes++;
        }

        for (const diag of (data.diagnostics || [])) {
          await window.db.diagnostics.create({
            name:        diag.name + ' (импорт)',
            description: diag.description || '',
            fill_by:     diag.fill_by || 'teacher',
            questions:   diag.questions || { version: 2, elements: [], subscales: [], interpretation: null },
          });
          addedDiag++;
        }

        toast(`Импортировано: ${addedEx} упражнений, ${addedSes} занятий, ${addedDiag} диагностик`, 'success');
        await Router.go(Router._current || 'exercises');
      } catch(e) {
        toast('Ошибка импорта: ' + e.message, 'error');
      }
    },
    'Импортировать', false
  );
}
