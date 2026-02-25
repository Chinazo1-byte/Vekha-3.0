// ── Страница «Занятия» ────────────────────────────────────────────────────────
Router.register('sessions', loadSessionsPage);

let _sessions      = [];
let _allExForSes   = [];
let _sesCategories = [];

async function loadSessionsPage() {
  [_sessions, _allExForSes, _sesCategories] = await Promise.all([
    window.db.sessions.getAll(),
    window.db.exercises.getAll(),
    window.db.categories.getAll(),
  ]);
  renderSessionsPage();
  setTimeout(() => {
    Tour.startIfNeeded('sessions');
  }, 800);
}

function renderSessionsPage() {
  const page      = document.getElementById('page-sessions');
  const templates = _sessions.filter(s => s.is_template);
  const oneoff    = _sessions.filter(s => !s.is_template);

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Занятия</h1>
        <p class="page-subtitle">Цепочки упражнений и шаблоны</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="btn-new-session">Новое занятие</button>
        <button class="btn btn-ghost btn-sm tour-help-btn" onclick="Tour.start('sessions')" title="Подсказки по разделу">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 14v-1M10 10c0-1.5 2-2 2-3.5a2 2 0 0 0-4 0"/></svg>
        </button>
        <button class="btn btn-primary" id="btn-new-template">${Icons.plus} Создать шаблон</button>
      </div>
    </div>

    ${templates.length > 0 ? `
      <div class="section-label">Шаблоны</div>
      <div class="exercise-grid" style="margin-bottom:28px">
        ${templates.map(renderSessionCard).join('')}
      </div>` : ''}

    ${oneoff.length > 0 ? `
      <div class="section-label">Разовые занятия</div>
      <div class="exercise-grid">
        ${oneoff.map(renderSessionCard).join('')}
      </div>` : ''}

    ${_sessions.length === 0 ? `
      <div class="empty-state">
        <div class="empty-illustration">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M6 10h24M6 18h16M6 26h10" stroke="#9C9C94" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-title">Нет занятий</div>
        <div class="empty-text">Создайте цепочку упражнений или шаблон для повторного использования</div>
        <button class="btn btn-primary" id="btn-new-session-empty">${Icons.plus} Создать занятие</button>
      </div>` : ''}
  `;

  page.querySelector('#btn-new-session')?.addEventListener('click', () => openSessionModal(false));
  page.querySelector('#btn-new-template')?.addEventListener('click', () => openSessionModal(true));
  page.querySelector('#btn-new-session-empty')?.addEventListener('click', () => openSessionModal(false));

  page.querySelectorAll('.btn-play-session').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openLaunchSessionModal(parseInt(btn.dataset.id));
    });
  });

  page.querySelectorAll('.btn-del-session').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const s  = _sessions.find(s => s.id === id);
      Modal.confirm('Удалить занятие', `Удалить «${escHtml(s?.name)}»?`, async () => {
        await window.db.sessions.delete(id);
        toast('Удалено');
        await loadSessionsPage();
      });
    });
  });

  page.querySelectorAll('.session-card[data-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-actions')) return;
      const s = _sessions.find(s => s.id === parseInt(card.dataset.id));
      if (s) openSessionModal(!!s.is_template, s);
    });
  });
}

function renderSessionCard(s) {
  let exIds = [];
  try { exIds = JSON.parse(s.exercise_ids || '[]'); } catch(e) {}
  const exNames = exIds.map(id => {
    const ex = _allExForSes.find(e => e.id === id);
    return ex ? ex.name : '?';
  });

  return `
    <div class="exercise-card card-clickable session-card" data-id="${s.id}">
      <div class="card-actions">
        <button class="btn btn-icon btn-ghost btn-play-session" data-id="${s.id}" title="Запустить">${Icons.play}</button>
        <button class="btn btn-icon btn-ghost btn-del-session" data-id="${s.id}" title="Удалить">${Icons.trash}</button>
      </div>
      ${s.is_template
        ? `<span class="exercise-type-badge" style="background:#EDE9FE;color:#7C3AED">Шаблон</span>`
        : `<span class="exercise-type-badge" style="background:var(--green-l);color:var(--green)">Занятие</span>`}
      <div class="exercise-name">${escHtml(s.name)}</div>
      <div style="font-size:12.5px;color:var(--text-3);margin-top:4px;margin-bottom:8px">
        ${exIds.length} ${plural(exIds.length,'упражнение','упражнения','упражнений')}
      </div>
      ${exNames.slice(0,3).map(n => `
        <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-2);margin-top:3px">
          <span style="width:5px;height:5px;border-radius:50%;background:var(--indigo);flex-shrink:0"></span>
          ${escHtml(n)}
        </div>`).join('')}
      ${exNames.length > 3 ? `<div class="text-muted text-sm" style="margin-top:4px">+${exNames.length-3} ещё</div>` : ''}
    </div>`;
}

// ── Конструктор цепочки ───────────────────────────────────────────────────────
async function openSessionModal(isTemplate, existing) {
  // Всегда загружаем свежий список упражнений
  _allExForSes = await window.db.exercises.getAll();

  let chain = [];
  if (existing) {
    try { chain = JSON.parse(existing.exercise_ids || '[]'); } catch(e) {}
  }

  const catOptions = _sesCategories.map(c =>
    `<option value="${c.id}" ${existing?.category_id === c.id ? 'selected':''}>${escHtml(c.name)}</option>`
  ).join('');

  Modal.open(
    existing ? 'Редактировать' : (isTemplate ? 'Новый шаблон' : 'Новое занятие'),
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">Название</label>
          <input class="input-field" id="ses-name" placeholder="${isTemplate ? 'Шаблон по памяти' : 'Занятие с Ваней'}" value="${escHtml(existing?.name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Категория</label>
          <select class="input-field select-field" id="ses-cat">
            <option value="">Без категории</option>
            ${catOptions}
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;height:360px">
        <!-- Библиотека -->
        <div style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">
            Библиотека упражнений
          </div>
          <div style="padding:8px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px" id="ses-library">
            ${_allExForSes.length === 0
              ? `<div style="padding:20px;text-align:center;font-size:13px;color:var(--text-3)">Нет упражнений.<br>Создайте их в разделе «Упражнения».</div>`
              : _allExForSes.map(ex => {
                  const m = exerciseTypeMeta(ex.type);
                  return `<div class="chain-item ses-lib-item" data-exid="${ex.id}" style="cursor:pointer">
                    <div style="width:8px;height:8px;border-radius:50%;background:${m.color};flex-shrink:0"></div>
                    <div style="flex:1;min-width:0">
                      <div class="chain-item-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(ex.name)}</div>
                      <div class="chain-item-type" style="color:${m.color}">${m.label}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color:var(--indigo);flex-shrink:0"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                  </div>`;
                }).join('')}
          </div>
        </div>

        <!-- Цепочка -->
        <div style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;justify-content:space-between">
            Цепочка занятия
            <span id="ses-chain-count" style="background:var(--indigo-l);color:var(--indigo);padding:2px 8px;border-radius:10px;font-size:11px">${chain.length}</span>
          </div>
          <div style="padding:8px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px" id="ses-chain-list">
          </div>
        </div>
      </div>
    </div>`,
    `<button class="btn btn-ghost" id="ses-cancel-btn">Отмена</button>
     <button class="btn btn-primary" id="ses-save-btn">${existing ? 'Сохранить' : 'Создать'}</button>`, 'Удалить', true
  );

  // Инициализируем цепочку в памяти
  let sesChain = [...chain];

  function renderChain() {
    const list    = document.getElementById('ses-chain-list');
    const countEl = document.getElementById('ses-chain-count');
    if (!list) return;
    if (countEl) countEl.textContent = sesChain.length;

    if (sesChain.length === 0) {
      list.innerHTML = `<div style="padding:24px 12px;text-align:center;font-size:13px;color:var(--text-3)">
        Нажмите на упражнение слева, чтобы добавить в цепочку
      </div>`;
      return;
    }

    list.innerHTML = sesChain.map((exId, idx) => {
      const ex = _allExForSes.find(e => e.id === exId);
      if (!ex) return '';
      const m = exerciseTypeMeta(ex.type);
      return `<div class="chain-item" style="user-select:none">
        <div class="chain-item-num">${idx+1}</div>
        <div style="flex:1;min-width:0">
          <div class="chain-item-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(ex.name)}</div>
          <div class="chain-item-type" style="color:${m.color}">${m.label}</div>
        </div>
        <div style="display:flex;gap:2px">
          <button class="btn btn-icon btn-ghost btn-sm chain-up" data-idx="${idx}" style="opacity:${idx===0?'.25':'1'}" ${idx===0?'disabled':''}>↑</button>
          <button class="btn btn-icon btn-ghost btn-sm chain-down" data-idx="${idx}" style="opacity:${idx===sesChain.length-1?'.25':'1'}" ${idx===sesChain.length-1?'disabled':''}>↓</button>
          <button class="btn btn-icon btn-ghost btn-sm chain-remove" data-idx="${idx}" style="color:var(--rose)">${Icons.trash}</button>
        </div>
      </div>`;
    }).join('');

    // Порядок
    list.querySelectorAll('.chain-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        if (i > 0) { [sesChain[i-1], sesChain[i]] = [sesChain[i], sesChain[i-1]]; renderChain(); }
      });
    });
    list.querySelectorAll('.chain-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        if (i < sesChain.length-1) { [sesChain[i], sesChain[i+1]] = [sesChain[i+1], sesChain[i]]; renderChain(); }
      });
    });
    list.querySelectorAll('.chain-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        sesChain.splice(parseInt(btn.dataset.idx), 1);
        renderChain();
      });
    });
  }

  // Добавление из библиотеки
  document.querySelectorAll('.ses-lib-item').forEach(item => {
    item.addEventListener('click', () => {
      const exId = parseInt(item.dataset.exid);
      if (!sesChain.includes(exId)) {
        sesChain.push(exId);
        renderChain();
      } else {
        toast('Упражнение уже добавлено', '');
      }
    });
  });

  renderChain();

  // Кнопки модалки
  document.getElementById('ses-cancel-btn')?.addEventListener('click', () => Modal.close());

  document.getElementById('ses-save-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('ses-name').value.trim();
    if (!name) { toast('Введите название', 'error'); return; }
    if (sesChain.length === 0) { toast('Добавьте хотя бы одно упражнение', 'error'); return; }

    const catId = document.getElementById('ses-cat').value;
    const data  = {
      name,
      category_id:  catId ? parseInt(catId) : null,
      exercise_ids: sesChain,
      is_template:  isTemplate,
    };

    if (existing) {
      await window.db.sessions.update({ id: existing.id, ...data });
      toast('Сохранено', 'success');
    } else {
      await window.db.sessions.create(data);
      toast(isTemplate ? 'Шаблон создан' : 'Занятие создано', 'success');
    }
    Modal.close();
    await loadSessionsPage();
  });
}

// ── Запуск занятия ────────────────────────────────────────────────────────────
async function openLaunchSessionModal(sessionId) {
  const students = await window.db.students.getAll();
  const s = _sessions.find(s => s.id === sessionId);

  Modal.open(
    `Запустить: ${escHtml(s?.name || '')}`,
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Ученик</label>
        <select class="input-field select-field" id="launch-student">
          <option value="">Без привязки к ученику</option>
          ${students.map(st =>
            `<option value="${st.id}">${escHtml(st.first_name)} ${escHtml(st.last_name||'')}</option>`
          ).join('')}
        </select>
      </div>
      <div style="font-size:13px;color:var(--text-3);line-height:1.6">
        Если выбрать ученика — результаты сохранятся в его карточку.
      </div>
    </div>`,
    `<button class="btn btn-ghost" id="launch-cancel">Отмена</button>
     <button class="btn btn-primary" id="launch-go">Начать занятие</button>`
  );

  document.getElementById('launch-cancel').addEventListener('click', () => Modal.close());
  document.getElementById('launch-go').addEventListener('click', () => {
    const sid = document.getElementById('launch-student').value;
    Modal.close();
    SessionPlayer.start(sessionId, sid ? parseInt(sid) : null);
  });
}
