// ── Страница «Упражнения» ─────────────────────────────────────────────────────
Router.register('exercises', loadExercisesPage);

let _exercises  = [];
let _categories = [];
let _exFilter   = { search: '', type: '', difficulty: '' };

async function loadExercisesPage() {
  [_exercises, _categories] = await Promise.all([
    window.db.exercises.getAll(),
    window.db.categories.getAll(),
  ]);
  renderExercisesPage();
}

function renderExercisesPage() {
  const page     = document.getElementById('page-exercises');
  const filtered = filterExercises();

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Упражнения</h1>
        <p class="page-subtitle">${_exercises.length} ${plural(_exercises.length,'упражнение','упражнения','упражнений')} создано</p>
      </div>
      <div class="page-actions">
        <div class="search-bar">
          ${Icons.search}
          <input type="text" placeholder="Поиск..." id="ex-search" value="${escHtml(_exFilter.search)}">
        </div>
        <button class="btn btn-primary" id="btn-add-exercise">${Icons.plus} Создать</button>
      </div>
    </div>

    <div class="filter-bar">
      <button class="filter-chip ${!_exFilter.type && !_exFilter.difficulty ? 'active' : ''}" data-reset>Все</button>
      ${EXERCISE_TYPES.map(t => `
        <button class="filter-chip ${_exFilter.type === t.key ? 'active' : ''}" data-ftype="${t.key}">${t.label}</button>
      `).join('')}
      <span style="color:var(--border-2);font-size:12px;margin-left:2px">Сложность:</span>
      ${['easy','medium','hard'].map(d => `
        <button class="filter-chip difficulty-${d} ${_exFilter.difficulty === d ? 'active' : ''}" data-fdiff="${d}">
          ${DIFFICULTY_LABELS[d]}
        </button>`).join('')}
    </div>

    ${filtered.length === 0
      ? renderExercisesEmpty()
      : `<div class="exercise-grid">${filtered.map(renderExerciseCard).join('')}</div>`}
  `;

  page.querySelector('#ex-search')?.addEventListener('input', e => {
    _exFilter.search = e.target.value;
    renderExercisesPage();
  });
  page.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => {
    _exFilter.type = ''; _exFilter.difficulty = ''; renderExercisesPage();
  });
  page.querySelectorAll('[data-ftype]').forEach(b => b.onclick = () => {
    _exFilter.type = _exFilter.type === b.dataset.ftype ? '' : b.dataset.ftype;
    renderExercisesPage();
  });
  page.querySelectorAll('[data-fdiff]').forEach(b => b.onclick = () => {
    _exFilter.difficulty = _exFilter.difficulty === b.dataset.fdiff ? '' : b.dataset.fdiff;
    renderExercisesPage();
  });

  document.getElementById('btn-add-exercise')?.addEventListener('click', () => openExerciseModal());

  // Кнопки действий на карточках
  page.querySelectorAll('.btn-ex-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      Editor.open(parseInt(btn.dataset.id), loadExercisesPage);
    });
  });

  page.querySelectorAll('.btn-ex-play').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openLaunchModal(parseInt(btn.dataset.id));
    });
  });

  page.querySelectorAll('.btn-ex-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const ex = _exercises.find(e => e.id === id);
      Modal.confirm('Удалить упражнение', `Удалить «${escHtml(ex?.name)}»?`, async () => {
        await window.db.exercises.delete(id);
        toast('Упражнение удалено');
        await loadExercisesPage();
      });
    });
  });

  // Клик по карточке → редактор
  page.querySelectorAll('.exercise-card[data-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-actions')) return;
      Editor.open(parseInt(card.dataset.id), loadExercisesPage);
    });
  });
}

function filterExercises() {
  return _exercises.filter(e => {
    const q = _exFilter.search.toLowerCase();
    if (q && !(e.name || '').toLowerCase().includes(q)) return false;
    if (_exFilter.type && e.type !== _exFilter.type) return false;
    if (_exFilter.difficulty && e.difficulty !== _exFilter.difficulty) return false;
    return true;
  });
}

function renderExerciseCard(ex) {
  const meta    = exerciseTypeMeta(ex.type);
  const hasEdit = true;

  return `
    <div class="exercise-card card-clickable" data-id="${ex.id}">
      <div class="card-actions">
        ${hasEdit ? `<button class="btn btn-icon btn-ghost btn-ex-edit" data-id="${ex.id}" title="Редактировать">${Icons.pencil}</button>` : ''}
        <button class="btn btn-icon btn-ghost btn-ex-play" data-id="${ex.id}" title="Запустить">${Icons.play}</button>
        <button class="btn btn-icon btn-ghost btn-ex-delete" data-id="${ex.id}" title="Удалить">${Icons.trash}</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:${meta.colorL};color:${meta.color};flex-shrink:0">${typeIcon(ex.type, 18)}</span>
        <span class="exercise-type-badge" style="background:${meta.colorL};color:${meta.color}">${meta.label}</span>
      </div>
      <div class="exercise-name">${escHtml(ex.name)}</div>
      <div class="exercise-meta">
        ${difficultyTag(ex.difficulty)}
        ${ex.category_name ? `
          <span class="tag" style="background:${ex.category_color}18;color:${ex.category_color}">
            <span class="color-dot" style="background:${ex.category_color}"></span>${escHtml(ex.category_name)}
          </span>` : ''}
      </div>
    </div>`;
}

function renderExercisesEmpty() {
  if (_exFilter.search || _exFilter.type || _exFilter.difficulty) return `
    <div class="empty-state">
      <div class="empty-illustration">${Icons.search}</div>
      <div class="empty-title">Ничего не найдено</div>
      <div class="empty-text">Попробуйте изменить фильтры</div>
    </div>`;
  return `
    <div class="empty-state">
      <div class="empty-illustration">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="4" y="4" width="13" height="13" rx="3" stroke="#9C9C94" stroke-width="2"/>
          <rect x="19" y="4" width="13" height="13" rx="3" stroke="#9C9C94" stroke-width="2"/>
          <rect x="4" y="19" width="13" height="13" rx="3" stroke="#9C9C94" stroke-width="2"/>
          <path d="M25.5 19v13M19 25.5h13" stroke="#9C9C94" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="empty-title">Нет упражнений</div>
      <div class="empty-text">Создайте первое упражнение и наполните его содержимым в редакторе.</div>
      <button class="btn btn-primary" onclick="openExerciseModal()">${Icons.plus} Создать упражнение</button>
    </div>`;
}

// ── Модалка создания упражнения ───────────────────────────────────────────────
function openExerciseModal(existing) {
  const isEdit    = !!existing;
  let selectedType = existing?.type || '';

  const catOptions = _categories.map(c =>
    `<option value="${c.id}" ${existing?.category_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
  ).join('');

  Modal.open(
    isEdit ? 'Редактировать упражнение' : 'Новое упражнение',
    `<div style="display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">Название</label>
        <input class="input-field" id="ex-name" placeholder="Например: Фрукты и овощи" value="${escHtml(existing?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Тип упражнения</label>
        <div class="type-grid">
          ${EXERCISE_TYPES.map(t => `
            <div class="type-tile ${selectedType === t.key ? 'selected' : ''}" data-type="${t.key}">
              <div class="type-tile-icon" style="color:${t.color}">${typeIcon(t.key, 24)}</div>
              <div class="type-tile-name">${t.label}</div>
            </div>`).join('')}
        </div>
        <input type="hidden" id="ex-type" value="${escHtml(selectedType)}">
      </div>
      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">Сложность</label>
          <select class="input-field select-field" id="ex-difficulty">
            <option value="easy"   ${existing?.difficulty === 'easy'   ? 'selected':''}>Лёгкое</option>
            <option value="medium" ${!existing || existing?.difficulty==='medium' ? 'selected':''}>Среднее</option>
            <option value="hard"   ${existing?.difficulty === 'hard'   ? 'selected':''}>Сложное</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Категория</label>
          <select class="input-field select-field" id="ex-category">
            <option value="">Без категории</option>
            ${catOptions}
          </select>
        </div>
      </div>
    </div>`,
    `<button class="btn btn-ghost" onclick="Modal.close()">Отмена</button>
     <button class="btn btn-primary" id="btn-save-ex">${isEdit ? 'Сохранить' : 'Создать'}</button>`, 'Удалить', true
  );

  document.querySelectorAll('.type-tile').forEach(tile => {
    tile.onclick = () => {
      document.querySelectorAll('.type-tile').forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      document.getElementById('ex-type').value = tile.dataset.type;
    };
  });

  document.getElementById('btn-save-ex').onclick = async () => {
    const name = document.getElementById('ex-name').value.trim();
    const type = document.getElementById('ex-type').value;
    if (!name) { toast('Введите название', 'error'); return; }
    if (!type) { toast('Выберите тип', 'error'); return; }
    const catId = document.getElementById('ex-category').value;
    const data  = {
      name, type,
      difficulty:  document.getElementById('ex-difficulty').value,
      category_id: catId ? parseInt(catId) : null,
      content: existing?.content || {},
    };
    if (isEdit) {
      await window.db.exercises.update({ id: existing.id, ...data });
      toast('Сохранено', 'success');
    } else {
      const created = await window.db.exercises.create(data);
      toast('Упражнение создано', 'success');
      Modal.close();
      await loadExercisesPage();
      // Сразу открыть редактор
      if (['visual_match','find_pairs','odd_one_out','sorting'].includes(type)) {
        setTimeout(() => Editor.open(created.id, loadExercisesPage), 200);
      }
      return;
    }
    Modal.close();
    await loadExercisesPage();
  };
}

// ── Модалка запуска (выбор ученика) ──────────────────────────────────────────
async function openLaunchModal(exerciseId) {
  const students = await window.db.students.getAll();
  const ex       = _exercises.find(e => e.id === exerciseId);

  Modal.open(
    `Запустить: ${escHtml(ex?.name || '')}`,
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Ученик (необязательно)</label>
        <select class="input-field select-field" id="launch-student">
          <option value="">Без привязки к ученику</option>
          ${students.map(s => `<option value="${s.id}">${escHtml(s.first_name)} ${escHtml(s.last_name||'')}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:13px;color:var(--text-3);line-height:1.6">
        Если выбрать ученика — результат сохранится в его карточке.
      </div>
    </div>`,
    `<button class="btn btn-ghost" onclick="Modal.close()">Отмена</button>
     <button class="btn btn-primary" id="btn-launch-start">Начать</button>`
  );

  document.getElementById('btn-launch-start').onclick = () => {
    const sid = document.getElementById('launch-student').value;
    Modal.close();
    Player.start(exerciseId, sid ? parseInt(sid) : null);
  };
}
