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
    splash.classList.add('fade-out');
    if(app) app.style.display = '';
    setTimeout(() => splash.remove(), 600);
  }

  video.addEventListener('ended', hideSplash);
  setTimeout(hideSplash, 9000); // страховка на 9 сек
  video.play().catch(() => hideSplash());
}

// ── Инициализация приложения ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initSplash();
  await Router.go('students');
  initSoundToggle();
  initQuitButton();
  initLibraryButtons();
});

// ── Кнопка звука ──────────────────────────────────────────────────────────────
function initSoundToggle() {
  function update() {
    const on    = Sound.isEnabled();
    const btn   = document.getElementById('sound-toggle-btn');
    const label = document.getElementById('sound-label');
    const wave  = document.getElementById('sound-wave-1');
    if (!btn) return;
    label.textContent = on ? 'Звук включён' : 'Звук выключен';
    btn.style.opacity = on ? '1' : '0.5';
    if (wave) wave.style.display = on ? '' : 'none';
  }
  document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
    Sound.setEnabled(!Sound.isEnabled());
    if (Sound.isEnabled()) Sound.click();
    update();
  });
  update();
}

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
function initLibraryButtons() {
  document.getElementById('btn-export-library')?.addEventListener('click', exportLibrary);
  document.getElementById('btn-import-library')?.addEventListener('click', importLibrary);
}

async function exportLibrary() {
  try {
    const exercises = await window.db.exercises.getAll();
    const sessions  = await window.db.sessions.getAll();

    const exWithContent = await Promise.all(exercises.map(ex => window.db.exercises.get(ex.id)));

    const payload = {
      version:   '1.0',
      app:       'Веха',
      exported:  new Date().toISOString(),
      exercises: exWithContent,
      sessions:  sessions,
    };

    const result = await window.db.library.export(payload);
    if (result.canceled) return;
    if (result.ok) toast(`Экспортировано: ${exWithContent.length} упражнений, ${sessions.length} занятий`, 'success');
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

  const exCount  = (data.exercises || []).length;
  const sesCount = (data.sessions  || []).length;

  Modal.confirm('Импортировать библиотеку?', `Будет добавлено: <b>${exCount}</b> упражнений и <b>${sesCount}</b> занятий.<br>
     <small style="color:var(--text-3)">Существующие данные не удаляются — импорт добавляется поверх.</small>`,
  async () => { try { let addedEx = 0, addedSes = 0;
        const idMap = {};

        for (const ex of (data.exercises || [])) {
          const oldId = ex.id;
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

        toast(`Импортировано: ${addedEx} упражнений, ${addedSes} занятий`, 'success');
        await Router.go(Router._current || 'exercises');
      } catch(e) {
        toast('Ошибка импорта: ' + e.message, 'error');
      }
    }
  , 'Импортировать', false);
}
