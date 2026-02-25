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
  }, 400);
}

function renderDiagnosticsPage() {
  const page     = document.getElementById('page-diagnostics');
  const builtin  = getAllDiagMethods(); // из diag_methods.js
  const custom   = _diagnostics.filter(d => !d.method_id);

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

    <!-- Встроенные методики -->
    <div style="font-size:12.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">
      Встроенные методики
    </div>
    <div class="exercise-grid" style="margin-bottom:32px">
      ${builtin.map(renderBuiltinCard).join('')}
    </div>

    <!-- Пользовательские -->
    ${custom.length ? `
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

// ── Карточка встроенной методики ─────────────────────────────────────────────
function renderBuiltinCard(m) {
  const categoryColors = {
    emotional:      ['var(--rose-l)',   'var(--rose)'],
    memory:         ['var(--indigo-l)', 'var(--indigo)'],
    thinking:       ['var(--amber-l)',  'var(--amber)'],
    attention:      ['var(--green-l)',  'var(--green)'],
    selfesteem:     ['var(--teal-l)',   'var(--teal)'],
    schoolReadiness:['var(--purple-l)', 'var(--purple)'],
  };
  const [bg, col] = categoryColors[m.category] || ['var(--surface-2)', 'var(--text-3)'];

  return `
    <div class="exercise-card" style="position:relative">
      <div class="card-actions">
        <button class="btn btn-icon btn-ghost btn-run-builtin" data-mid="${m.id}" title="Провести">${Icons.play}</button>
      </div>
      <div style="font-size:28px;margin-bottom:10px;line-height:1">${m.icon}</div>
      <span class="exercise-type-badge" style="background:${bg};color:${col};margin-bottom:8px">${m.shortName}</span>
      <div class="exercise-name">${escHtml(m.name)}</div>
      <div style="font-size:12.5px;color:var(--text-3);line-height:1.5;margin-bottom:8px">${escHtml(m.description)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="tag">Возраст: ${m.ageRange}</span>
        <span class="tag">${m.fill_by === 'teacher' ? 'Педагог заполняет' : 'Ученик отвечает'}</span>
      </div>
    </div>`;
}

// ── Карточка пользовательского опросника ─────────────────────────────────────
function renderCustomCard(d) {
  let qCount = 0;
  try { qCount = JSON.parse(d.questions || '[]').length; } catch(e) {}
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
