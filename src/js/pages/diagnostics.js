// ══════════════════════════════════════════════════════════════════════════════
//  СТРАНИЦА «ДИАГНОСТИКИ»
// ══════════════════════════════════════════════════════════════════════════════
Router.register('diagnostics', loadDiagnosticsPage);

let _diagnostics = [];

async function loadDiagnosticsPage() {
  _diagnostics = await window.db.diagnostics.getAll();
  renderDiagnosticsPage();
  setTimeout(() => {
    Tour.startIfNeeded('diagnostics');
  }, 800);
}

// ── Возрастные группы для встроенных методик ─────────────────────────────────
const DIAG_AGE_GROUPS = [
  {
    id: 'preschool',
    label: 'Дошкольники',
    ageRange: '4–7 лет',
    color: 'var(--purple)',
    bg: 'var(--purple-l)',
    border: 'rgba(124,58,237,.18)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3l8 -8"/><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9"/></svg>`,
    ids: ['ladder', 'kernYerasek', 'personal_expectations_child'],
  },
  {
    id: 'primary',
    label: 'Младший школьный',
    ageRange: '7–12 лет',
    color: 'var(--indigo)',
    bg: 'var(--indigo-l)',
    border: 'rgba(79,70,229,.18)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/></svg>`,
    ids: ['luscher', 'luria10', 'fourthOdd', 'pierronRoser', 'vas', 'ebbinghaus_fill_blank', 'luskan', 'phillips'],
  },
  {
    id: 'adolescent',
    label: 'Подростки',
    ageRange: '12+ лет',
    color: 'var(--teal)',
    bg: 'var(--teal-l)',
    border: 'rgba(13,148,136,.18)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>`,
    ids: ['san_wellbeing', 'ost_rusalov', 'rokich_values', 'sociometry'],
  },
];

function renderDiagnosticsPage() {
  const page    = document.getElementById('page-diagnostics');
  const allMethods = getAllDiagMethods();
  const custom  = _diagnostics.filter(d => !d.method_id);

  // Раскладываем методики по группам, неназначенные — в «другие»
  const assignedIds = new Set(DIAG_AGE_GROUPS.flatMap(g => g.ids));
  const other = allMethods.filter(m => !assignedIds.has(m.id));

  const groupsHTML = DIAG_AGE_GROUPS.map(group => {
    const methods = group.ids.map(id => allMethods.find(m => m.id === id)).filter(Boolean);
    if (!methods.length) return '';
    return `
      <div style="margin-bottom:32px">
        <!-- Заголовок группы -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;
             background:${group.bg};border:1px solid ${group.border};border-radius:var(--r-xl)">
          <div style="width:32px;height:32px;border-radius:var(--r-lg);background:${group.color};
               color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              ${group.icon.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
            </svg>
          </div>
          <div>
            <div style="font-size:13.5px;font-weight:700;color:${group.color};line-height:1.2">${escHtml(group.label)}</div>
            <div style="font-size:11.5px;color:${group.color};opacity:.7">${escHtml(group.ageRange)}</div>
          </div>
          <div style="margin-left:auto;font-size:11.5px;font-weight:600;color:${group.color};
               opacity:.6">${methods.length} ${plural(methods.length,'методика','методики','методик')}</div>
        </div>
        <div class="exercise-grid">
          ${methods.map(m => renderBuiltinCard(m, group)).join('')}
        </div>
      </div>`;
  }).join('');

  const otherHTML = other.length ? `
    <div style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;
           background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-xl)">
        <div style="width:32px;height:32px;border-radius:var(--r-lg);background:var(--text-3);
             color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z"/><path d="M12 8v4"/><path d="M12 16v.01"/>
          </svg>
        </div>
        <div>
          <div style="font-size:13.5px;font-weight:700;color:var(--text-2);line-height:1.2">Все возрасты</div>
          <div style="font-size:11.5px;color:var(--text-3)">Универсальные методики</div>
        </div>
        <div style="margin-left:auto;font-size:11.5px;font-weight:600;color:var(--text-3)">${other.length} ${plural(other.length,'методика','методики','методик')}</div>
      </div>
      <div class="exercise-grid">
        ${other.map(m => renderBuiltinCard(m, null)).join('')}
      </div>
    </div>` : '';

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Диагностики</h1>
        <p class="page-subtitle">Встроенные методики и пользовательские опросники</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm tour-help-btn" onclick="Tour.start('diagnostics')" title="Подсказки по разделу">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 14v-1M10 10c0-1.5 2-2 2-3.5a2 2 0 0 0-4 0"/></svg>
        </button>
        <button class="btn btn-primary" id="btn-create-diag">${Icons.plus} Свой опросник</button>
      </div>
    </div>

    <!-- Встроенные методики по возрастным группам -->
    ${groupsHTML}
    ${otherHTML}

    <!-- Пользовательские -->
    ${custom.length ? `
      <div style="height:1px;background:var(--border);margin-bottom:28px"></div>
      <div style="font-size:12.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">
        Мои опросники
      </div>
      <div class="exercise-grid">
        ${custom.map(renderCustomCard).join('')}
      </div>` : ''}
  `;

  document.getElementById('btn-create-diag').addEventListener('click', () => openDiagModal());

  // Запуск встроенных
  page.querySelectorAll('.btn-run-builtin').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openLaunchDiagModal(btn.dataset.mid, true);
    });
  });

  // Пользовательские — делегирование через общий клик по странице
  page.querySelectorAll('.btn-diag-edit').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      e.preventDefault();
      const id = parseInt(btn.dataset.id);
      if (isNaN(id)) { toast('Ошибка: неверный ID диагностики', 'error'); return; }
      try {
        await DiagEditor.open(id, loadDiagnosticsPage);
      } catch (err) {
        console.error('[DiagEditor] Ошибка открытия редактора:', err);
        toast('Не удалось открыть редактор', 'error');
      }
    });
  });
  page.querySelectorAll('.btn-diag-play').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      e.preventDefault();
      openLaunchDiagModal(parseInt(btn.dataset.id), false);
    });
  });
  page.querySelectorAll('.btn-diag-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const id = parseInt(btn.dataset.id);
      const d  = _diagnostics.find(d => d.id === id);
      Modal.confirm('Удалить опросник', `Удалить «${escHtml(d?.name)}»?`, async () => {
        await window.db.diagnostics.delete(id);
        toast('Удалено');
        await loadDiagnosticsPage();
      });
    });
  });
}

// ── SVG-иконки для методик (Tabler-style, stroke-based, viewBox 0 0 24 24) ──
const DIAG_ICONS = {
  luscher:      `<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 3a4.5 4.5 0 0 1 0 9a4.5 4.5 0 0 0 0 9"/><path d="M12 3c2.485 0 4.5 4.03 4.5 9s-2.015 9 -4.5 9"/><line x1="3" y1="12" x2="21" y2="12"/>`,
  luria10:      `<path d="M3 12h1"/><path d="M12 3v1"/><path d="M7.1 7.1l-.7 -.7"/><path d="M16.9 7.1l.7 -.7"/><path d="M7.1 16.9l-.7 .7"/><path d="M16.9 16.9l.7 .7"/><path d="M12 21v-1"/><path d="M21 12h-1"/><path d="M12 7a5 5 0 1 1 -4.995 5.217l-.005 -.217l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M12 10a2 2 0 1 0 1.985 2.212l.015 -.212l-.015 -.212a2 2 0 0 0 -1.985 -1.788z"/>`,
  fourthOdd:    `<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M10 10l4 4m0 -4l-4 4"/>`,
  pierronRoser: `<path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>`,
  ladder:       `<path d="M5 3v18"/><path d="M19 3v18"/><path d="M5 8h14"/><path d="M5 13h14"/><path d="M5 18h14"/>`,
  kernYerasek:  `<path d="M3 19l9 -14l9 14"/><path d="M12 5v14"/><path d="M9 10l6 0"/>`,
  phillips:     `<path d="M9 12l2 2l4 -4"/><path d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0 -18z"/>`,
  luskan:       `<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6v13"/><path d="M12 6v13"/><path d="M21 6v13"/>`,
  sociometry:   `<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/>`,
  vas:          `<path d="M3 12h2"/><path d="M19 12h2"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M6.343 6.343l1.414 1.414"/><path d="M16.243 16.243l1.414 1.414"/><path d="M6.343 17.657l1.414 -1.414"/><path d="M16.243 7.757l1.414 -1.414"/>`,
  ebbinghaus_fill_blank: `<path d="M10 12h4"/><path d="M9 4a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3"/><path d="M15 4a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3"/>`,
  san_wellbeing:`<path d="M4 8h4"/><path d="M14 8h6"/><path d="M4 12h6"/><path d="M16 12h4"/><path d="M4 16h4"/><path d="M14 16h6"/>`,
  ost_rusalov:  `<path d="M6 20v-2a6 6 0 1 1 12 0v2"/><path d="M12 4a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z"/><path d="M6 20h12"/>`,
  rokich_values:`<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>`,
  personal_expectations_child: `<path d="M8 9h8"/><path d="M8 13h6"/><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"/>`,
};

// ── Карточка встроенной методики ─────────────────────────────────────────────
function renderBuiltinCard(m, group) {
  const categoryColors = {
    emotional:      ['var(--rose-l)',   'var(--rose)'],
    memory:         ['var(--indigo-l)', 'var(--indigo)'],
    thinking:       ['var(--amber-l)',  'var(--amber)'],
    attention:      ['var(--green-l)',  'var(--green)'],
    selfesteem:     ['var(--teal-l)',   'var(--teal)'],
    schoolReadiness:['var(--purple-l)', 'var(--purple)'],
  };

  // Цвет иконки берём из группы если есть, иначе из категории
  const [catBg, catCol] = categoryColors[m.category] || ['var(--surface-2)', 'var(--text-3)'];
  const iconCol = group ? group.color : catCol;
  const iconBg  = group ? group.bg    : catBg;
  const iconPaths = DIAG_ICONS[m.id] || `<path d="M9 5H7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2V7a2 2 0 0 0 -2 -2h-2"/><path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2"/><path d="M9 12h6"/><path d="M9 16h4"/>`;

  return `
    <div class="exercise-card" style="position:relative">
      <div class="card-actions">
        <button class="btn btn-icon btn-ghost btn-run-builtin" data-mid="${m.id}" title="Провести">${Icons.play}</button>
      </div>
      <div style="width:42px;height:42px;border-radius:var(--r-lg);background:${iconBg};
           display:flex;align-items:center;justify-content:center;margin-bottom:12px;
           border:1px solid ${iconCol}25">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${iconCol}"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          ${iconPaths}
        </svg>
      </div>
      <span class="exercise-type-badge" style="background:${catBg};color:${catCol};margin-bottom:8px">${escHtml(m.shortName)}</span>
      <div class="exercise-name">${escHtml(m.name)}</div>
      <div style="font-size:12.5px;color:var(--text-3);line-height:1.5;margin-bottom:10px">${escHtml(m.description)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="tag">Возраст: ${escHtml(m.ageRange)}</span>
        <span class="tag">${m.fill_by === 'teacher' ? 'Педагог заполняет' : 'Ученик отвечает'}</span>
      </div>
    </div>`;
}

// ── Карточка пользовательского опросника ─────────────────────────────────────
function renderCustomCard(d) {
  let qCount = 0;
  try {
    const q = typeof d.questions === 'string' ? JSON.parse(d.questions) : d.questions;
    qCount = (q?.version === 2) ? (q.elements?.length || 0) : (Array.isArray(q) ? q.length : 0);
  } catch(e) {}
  return `
    <div class="exercise-card">
      <div class="card-actions">
        <button class="btn btn-icon btn-ghost btn-diag-edit"   data-id="${d.id}" title="Редактировать">${Icons.pencil}</button>
        <button class="btn btn-icon btn-ghost btn-diag-play"   data-id="${d.id}" title="Провести">${Icons.play}</button>
        <button class="btn btn-icon btn-ghost btn-diag-delete" data-id="${d.id}" title="Удалить">${Icons.trash}</button>
      </div>
      <div style="font-size:28px;margin-bottom:10px">📋</div>
      <span class="exercise-type-badge" style="background:var(--surface-2);color:var(--text-3)">Опросник</span>
      <div class="exercise-name">${escHtml(d.name)}</div>
      ${d.description ? `<div style="font-size:12.5px;color:var(--text-3);margin-bottom:8px">${escHtml(d.description)}</div>` : ''}
      <span class="tag">${qCount} ${plural(qCount,'вопрос','вопроса','вопросов')}</span>
    </div>`;
}

// ── Запустить диагностику ─────────────────────────────────────────────────────
async function openLaunchDiagModal(idOrMethodId, isBuiltin) {
  const students = await window.db.students.getAll();
  let name = '';
  if (isBuiltin) {
    const m = getDiagMethod(idOrMethodId);
    name = m?.name || '';
  } else {
    const d = _diagnostics.find(d => d.id === idOrMethodId);
    name = d?.name || '';
  }

  Modal.open(
    `Провести: ${escHtml(name)}`,
    `<div class="form-group">
      <label class="form-label">Ученик</label>
      <select class="input-field select-field" id="diag-student">
        <option value="">Без привязки к ученику</option>
        ${students.map(s =>
          `<option value="${s.id}">${escHtml(s.first_name)} ${escHtml(s.last_name||'')}</option>`
        ).join('')}
      </select>
    </div>`,
    `<button class="btn btn-ghost" id="diag-cancel">Отмена</button>
     <button class="btn btn-primary" id="diag-go">Начать</button>`
  );

  document.getElementById('diag-cancel').addEventListener('click', () => Modal.close());
  document.getElementById('diag-go').addEventListener('click', () => {
    const sid = document.getElementById('diag-student').value;
    Modal.close();
    if (isBuiltin) {
      DiagPlayer.startBuiltin(idOrMethodId, sid ? parseInt(sid) : null);
    } else {
      DiagPlayer.startCustom(idOrMethodId, sid ? parseInt(sid) : null);
    }
  });
}

// ── Создать свой опросник ─────────────────────────────────────────────────────
function openDiagModal(existing) {
  const isEdit = !!existing;
  Modal.open(
    isEdit ? 'Редактировать опросник' : 'Новый опросник',
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Название</label>
        <input class="input-field" id="d-name" placeholder="Опросник тревожности" value="${escHtml(existing?.name||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Описание</label>
        <textarea class="input-field" id="d-desc" style="height:70px">${escHtml(existing?.description||'')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Кто заполняет</label>
        <select class="input-field select-field" id="d-fillby">
          <option value="teacher" ${!existing||existing.fill_by==='teacher'?'selected':''}>Педагог наблюдает</option>
          <option value="student" ${existing?.fill_by==='student'?'selected':''}>Ученик отвечает на экране</option>
        </select>
      </div>
    </div>`,
    `<button class="btn btn-ghost" id="d-cancel">Отмена</button>
     <button class="btn btn-primary" id="d-save">${isEdit ? 'Сохранить' : 'Создать'}</button>`
  );
  document.getElementById('d-cancel').addEventListener('click', () => Modal.close());
  document.getElementById('d-save').addEventListener('click', async () => {
    const name = document.getElementById('d-name').value.trim();
    if (!name) { toast('Введите название', 'error'); return; }
    const data = {
      name,
      description: document.getElementById('d-desc').value.trim(),
      fill_by:     document.getElementById('d-fillby').value,
      questions:   existing?.questions || [],
    };
    if (isEdit) {
      await window.db.diagnostics.update({ id: existing.id, ...data });
      Modal.close();
      try {
        await DiagEditor.open(existing.id, loadDiagnosticsPage);
      } catch(err) {
        console.error('[openDiagModal] ошибка открытия редактора:', err);
        toast('Не удалось открыть редактор', 'error');
      }
    } else {
      const created = await window.db.diagnostics.create(data);
      const newId   = created?.id ?? created;
      Modal.close();
      await loadDiagnosticsPage();
      setTimeout(async () => {
        try {
          await DiagEditor.open(typeof newId === 'bigint' ? Number(newId) : newId, loadDiagnosticsPage);
        } catch(err) {
          console.error('[openDiagModal] ошибка открытия редактора после создания:', err);
          toast('Опросник создан, но редактор не открылся', 'error');
        }
      }, 200);
    }
  });
}
