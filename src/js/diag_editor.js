// ══════════════════════════════════════════════════════════════════════════════
//  РЕДАКТОР ДИАГНОСТИК v2 — текстовые + визуальные типы
// ══════════════════════════════════════════════════════════════════════════════

// Описания визуальных типов вопросов
const VISUAL_Q_TYPES = [
  {
    key: 'color_rank',
    icon: '🎨',
    name: 'Ранжирование цветов',
    desc: 'Тест Люшера, ЦТО — выбрать цвета в порядке предпочтения',
    method: 'Люшер, ЦТО',
  },
  {
    key: 'color_pick',
    icon: '🖌️',
    name: 'Выбор цвета',
    desc: 'Выбрать один или несколько цветов из палитры',
    method: 'ЦТО, Эмоциональный профиль',
  },
  {
    key: 'face_pick',
    icon: '😊',
    name: 'Выбор лица / эмоции',
    desc: 'Тревожность Тэммл-Дорки, шкала настроения',
    method: 'Тэммл-Дорки, ШРЛТ',
  },
  {
    key: 'ladder',
    icon: '🪜',
    name: 'Лесенка',
    desc: 'Методика Щур — самооценка через выбор ступеньки',
    method: 'Щур, Дембо-Рубинштейн',
  },
  {
    key: 'shape_pick',
    icon: '🔷',
    name: 'Выбор фигуры',
    desc: 'Геометрические фигуры — личностные предпочтения',
    method: 'Тест Рейда, Геометрия личности',
  },
  {
    key: 'image_choice',
    icon: '🖼️',
    name: 'Выбор картинки',
    desc: 'Показать несколько изображений — выбрать одно',
    method: 'Розенцвейг, ТАТ-адаптации',
  },
  {
    key: 'likert',
    icon: '📊',
    name: 'Шкала (Никогда → Всегда)',
    desc: 'Классическая шкала Ликерта для опросников',
    method: 'SCARED, SDQ, опросники поведения',
  },
  {
    key: 'yesno',
    icon: '✅',
    name: 'Да / Нет',
    desc: 'Простой бинарный ответ',
    method: 'Большинство скрининговых методик',
  },
  {
    key: 'choice',
    icon: '🔘',
    name: 'Выбор из вариантов',
    desc: 'Свои варианты ответа',
    method: 'Любые опросники',
  },
  {
    key: 'text',
    icon: '📝',
    name: 'Текстовая заметка',
    desc: 'Педагог пишет наблюдение',
    method: 'Качественная оценка',
  },
];

const DiagEditor = {
  _el:        null,
  _diag:      null,
  _questions: [],
  _onSave:    null,
  _addTab:    'visual', // 'visual' | 'text'

  async open(diagId, onSave) {
    const d = await window.db.diagnostics.get(diagId);
    if (!d) return;
    this._diag   = d;
    this._onSave = onSave;
    try { this._questions = JSON.parse(d.questions || '[]'); } catch(e) { this._questions = []; }
    this._render();
  },

  close() { this._el?.remove(); this._el = null; },

  async _save() {
    await window.db.diagnostics.update({ ...this._diag, questions: this._questions });
    toast('Сохранено', 'success');
    this._onSave?.();
    this.close();
  },

  _render() {
    this._el?.remove();
    const el = document.createElement('div');
    el.className = 'editor-overlay';
    document.body.appendChild(el);
    this._el = el;

    const d = this._diag;
    const fillLabel = { teacher:'Педагог наблюдает', student:'Ученик отвечает', parent:'Родитель' }[d.fill_by] || '';

    el.innerHTML = `
      <div class="editor-topbar">
        <button class="btn btn-ghost btn-sm" id="de-close">${Icons.back} Назад</button>
        <div class="editor-title">${escHtml(d.name)}</div>
        <span class="editor-type-badge" style="background:var(--teal-l);color:var(--teal)">${fillLabel}</span>
        <div style="margin-left:auto;display:flex;gap:10px">
          <button class="btn btn-success" id="de-save">Сохранить</button>
        </div>
      </div>
      <div class="editor-body">
        <div class="editor-main" id="de-main" style="max-width:none;padding:28px 32px"></div>
        <div class="editor-sidebar" id="de-sidebar"></div>
      </div>`;

    el.querySelector('#de-close').addEventListener('click', () => this.close());
    el.querySelector('#de-save').addEventListener('click',  () => this._save());

    this._renderMain();
    this._renderSidebar();
  },

  _renderMain() {
    const main = document.getElementById('de-main');
    if (!main) return;

    main.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 440px;gap:28px;height:100%">

        <!-- Левая: список вопросов -->
        <div style="display:flex;flex-direction:column;gap:0;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0">
            <div>
              <div style="font-size:20px;font-weight:700;color:var(--text-1)">Вопросы методики</div>
              <div style="font-size:13px;color:var(--text-3);margin-top:2px">${this._questions.length} ${plural(this._questions.length,'вопрос','вопроса','вопросов')}</div>
            </div>
          </div>
          <div style="flex:1;overflow-y:auto;padding-right:4px" id="de-q-list"></div>
        </div>

        <!-- Правая: форма добавления -->
        <div style="overflow-y:auto">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px;position:sticky;top:0">
            <div style="font-size:13px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">
              Добавить вопрос
            </div>

            <!-- Табы: визуальные / текстовые -->
            <div style="display:flex;gap:0;background:var(--surface-2);border-radius:var(--r-md);padding:3px;margin-bottom:16px">
              <button class="de-tab ${this._addTab==='visual'?'active':''}" data-tab="visual"
                style="flex:1;padding:7px;border:none;font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;border-radius:var(--r-sm);transition:all .15s;
                background:${this._addTab==='visual'?'var(--surface)':'transparent'};
                color:${this._addTab==='visual'?'var(--text-1)':'var(--text-3)'}">
                🎨 Визуальные
              </button>
              <button class="de-tab ${this._addTab==='text'?'active':''}" data-tab="text"
                style="flex:1;padding:7px;border:none;font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;border-radius:var(--r-sm);transition:all .15s;
                background:${this._addTab==='text'?'var(--surface)':'transparent'};
                color:${this._addTab==='text'?'var(--text-1)':'var(--text-3)'}">
                📝 Текстовые
              </button>
            </div>

            <div id="de-type-picker" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;max-height:320px;overflow-y:auto"></div>

            <div id="de-q-form"></div>
          </div>
        </div>
      </div>`;

    document.querySelectorAll('.de-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._addTab = tab.dataset.tab;
        this._renderMain();
      });
    });

    this._renderTypePicker();
    this._renderQuestionList();
  },

  _renderTypePicker() {
    const container = document.getElementById('de-type-picker');
    if (!container) return;

    const types = this._addTab === 'visual'
      ? VISUAL_Q_TYPES.filter(t => !['likert','yesno','choice','text'].includes(t.key))
      : VISUAL_Q_TYPES.filter(t =>  ['likert','yesno','choice','text'].includes(t.key));

    container.innerHTML = types.map(t => `
      <div class="vtype-tile" data-key="${t.key}">
        <div class="vtype-icon">${t.icon}</div>
        <div>
          <div class="vtype-name">${t.name}</div>
          <div class="vtype-desc">${t.desc}</div>
        </div>
      </div>`).join('');

    container.querySelectorAll('.vtype-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        container.querySelectorAll('.vtype-tile').forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
        this._renderQuestionForm(tile.dataset.key);
      });
    });
  },

  _renderQuestionForm(typeKey) {
    const container = document.getElementById('de-q-form');
    if (!container) return;

    const typeInfo = VISUAL_Q_TYPES.find(t => t.key === typeKey);

    // Общее поле текста вопроса + специфичные настройки
    let specificHTML = '';

    if (typeKey === 'color_rank') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Набор цветов</label>
          <select class="input-field select-field" id="de-color-set">
            <option value="luscher8">Тест Люшера (8 цветов)</option>
            <option value="basic6">Базовые 6 цветов</option>
            <option value="cto10">ЦТО (10 цветов)</option>
          </select>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Количество выборов</label>
          <select class="input-field select-field" id="de-rank-count">
            <option value="8">Все 8 (полный)</option>
            <option value="3">Топ 3</option>
            <option value="1">Только 1 предпочитаемый</option>
          </select>
        </div>`;
    } else if (typeKey === 'color_pick') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Палитра</label>
          <select class="input-field select-field" id="de-cpick-set">
            <option value="emotions8">Эмоции (8 цветов)</option>
            <option value="basic12">12 цветов</option>
            <option value="luscher8">Люшер (8 цветов)</option>
          </select>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Режим выбора</label>
          <select class="input-field select-field" id="de-cpick-mode">
            <option value="single">Один цвет</option>
            <option value="multi">Несколько (до 3)</option>
          </select>
        </div>`;
    } else if (typeKey === 'face_pick') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Набор лиц</label>
          <select class="input-field select-field" id="de-face-set">
            <option value="emotions5">5 эмоций (😞😐🙂😊😄)</option>
            <option value="emotions3">3 состояния (😔😐😊)</option>
            <option value="anxiety">Тревожность (😊😟)</option>
          </select>
        </div>`;
    } else if (typeKey === 'ladder') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Количество ступенек</label>
          <select class="input-field select-field" id="de-ladder-steps">
            <option value="7">7 ступеней (методика Щур)</option>
            <option value="10">10 ступеней (Дембо-Рубинштейн)</option>
            <option value="5">5 ступеней (для младших)</option>
          </select>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Метка верхней ступени</label>
          <input class="input-field" id="de-ladder-top" placeholder="Самый лучший" value="Самый лучший">
        </div>
        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Метка нижней ступени</label>
          <input class="input-field" id="de-ladder-bot" placeholder="Самый плохой" value="Самый плохой">
        </div>`;
    } else if (typeKey === 'shape_pick') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Набор фигур</label>
          <select class="input-field select-field" id="de-shape-set">
            <option value="basic5">5 фигур (квадрат, круг, треугольник, зигзаг, прямоугольник)</option>
            <option value="basic4">4 фигуры (без зигзага)</option>
            <option value="extended">8 фигур (расширенный)</option>
          </select>
        </div>`;
    } else if (typeKey === 'image_choice') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Изображения для выбора</label>
          <div id="de-img-slots" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px"></div>
          <button class="btn btn-ghost btn-sm" id="de-add-img-slot" style="margin-top:8px">+ Добавить изображение</button>
        </div>`;
    } else if (typeKey === 'choice') {
      specificHTML = `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Варианты ответа (каждый с новой строки)</label>
          <textarea class="input-field" id="de-q-options" placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3" style="height:80px"></textarea>
        </div>`;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="form-group">
          <label class="form-label">Текст / инструкция</label>
          <textarea class="input-field" id="de-q-text"
            placeholder="${typeInfo ? typeInfo.desc : 'Текст вопроса...'}"
            style="height:60px"></textarea>
        </div>
        ${specificHTML}
        <button class="btn btn-primary" id="de-add-q-btn" style="margin-top:6px">${Icons.plus} Добавить</button>
      </div>`;

    // Инициализация слотов для картинок
    if (typeKey === 'image_choice') {
      this._imgSlots = [{ path: '', label: '' }, { path: '', label: '' }];
      this._renderImgSlots();

      document.getElementById('de-add-img-slot').addEventListener('click', () => {
        this._imgSlots.push({ path: '', label: '' });
        this._renderImgSlots();
      });
    }

    document.getElementById('de-add-q-btn').addEventListener('click', () => this._addQuestion(typeKey));
  },

  _imgSlots: [],

  _renderImgSlots() {
    const container = document.getElementById('de-img-slots');
    if (!container) return;
    container.innerHTML = this._imgSlots.map((sl, i) => `
      <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:10px;background:var(--surface-2)">
        ${sl.path
          ? `<img data-path="${escHtml(sl.path)}" class="lazy-img" style="width:100%;height:70px;object-fit:cover;border-radius:6px;margin-bottom:6px">`
          : `<div style="height:70px;background:var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;cursor:pointer;font-size:12px;color:var(--text-3)" class="de-pick-img" data-i="${i}">+ Выбрать</div>`}
        <input class="input-field" style="font-size:12px;padding:6px" placeholder="Подпись" value="${escHtml(sl.label)}"
          data-slot="${i}" id="de-img-label-${i}">
      </div>`).join('');

    container.querySelectorAll('.de-pick-img').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = +btn.dataset.i;
        const path = await window.db.files.pickImage();
        if (!path) return;
        this._imgSlots[i].path = path;
        this._renderImgSlots();
        loadLazyImages(container);
      });
    });
    container.querySelectorAll('[data-slot]').forEach(inp => {
      inp.addEventListener('input', () => {
        this._imgSlots[+inp.dataset.slot].label = inp.value;
      });
    });
  },

  _addQuestion(typeKey) {
    const text = document.getElementById('de-q-text')?.value.trim();
    if (!text) { toast('Введите текст / инструкцию', 'error'); return; }

    const q = { id: `q${Date.now()}`, type: typeKey, text };

    if (typeKey === 'color_rank') {
      q.colorSet   = document.getElementById('de-color-set')?.value || 'luscher8';
      q.rankCount  = parseInt(document.getElementById('de-rank-count')?.value || '8');
    } else if (typeKey === 'color_pick') {
      q.colorSet   = document.getElementById('de-cpick-set')?.value || 'emotions8';
      q.pickMode   = document.getElementById('de-cpick-mode')?.value || 'single';
    } else if (typeKey === 'face_pick') {
      q.faceSet    = document.getElementById('de-face-set')?.value || 'emotions5';
    } else if (typeKey === 'ladder') {
      q.steps      = parseInt(document.getElementById('de-ladder-steps')?.value || '7');
      q.topLabel   = document.getElementById('de-ladder-top')?.value || 'Самый лучший';
      q.botLabel   = document.getElementById('de-ladder-bot')?.value || 'Самый плохой';
    } else if (typeKey === 'shape_pick') {
      q.shapeSet   = document.getElementById('de-shape-set')?.value || 'basic5';
    } else if (typeKey === 'image_choice') {
      q.images     = this._imgSlots.filter(sl => sl.path || sl.label);
      if (q.images.length < 2) { toast('Добавьте минимум 2 изображения', 'error'); return; }
    } else if (typeKey === 'likert') {
      q.options = ['Никогда', 'Иногда', 'Часто', 'Всегда'];
      q.scores  = [0, 1, 2, 3];
    } else if (typeKey === 'yesno') {
      q.options = ['Нет', 'Да'];
      q.scores  = [0, 1];
    } else if (typeKey === 'choice') {
      const raw = document.getElementById('de-q-options')?.value || '';
      q.options = raw.split('\n').map(s => s.trim()).filter(Boolean);
      if (q.options.length < 2) { toast('Добавьте минимум 2 варианта', 'error'); return; }
      q.scores = q.options.map(() => 0);
    }

    this._questions.push(q);
    document.getElementById('de-q-text').value = '';
    this._renderQuestionList();
  },

  _renderQuestionList() {
    const container = document.getElementById('de-q-list');
    if (!container) return;

    if (!this._questions.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-3);background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-xl)">
          <div style="font-size:32px;margin-bottom:8px">📋</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-2);margin-bottom:4px">Нет вопросов</div>
          <div style="font-size:13px">Выберите тип справа и добавьте первый</div>
        </div>`;
      return;
    }

    container.innerHTML = this._questions.map((q, i) => {
      const info  = VISUAL_Q_TYPES.find(t => t.key === q.type) || { icon:'📝', name: q.type };
      const badge = this._qBadgeHTML(q);
      return `
        <div class="item-card" style="margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
          <div class="item-number" style="flex-shrink:0;margin-top:2px">${i+1}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span style="font-size:18px">${info.icon}</span>
              <span style="font-size:12px;font-weight:700;color:var(--teal);background:var(--teal-l);padding:2px 8px;border-radius:10px">${info.name}</span>
            </div>
            <div style="font-size:13.5px;font-weight:500;color:var(--text-1);line-height:1.5;margin-bottom:6px">${escHtml(q.text)}</div>
            ${badge}
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
            <button class="btn btn-icon btn-ghost btn-sm de-up"   data-i="${i}" style="opacity:${i===0?.35:1};padding:4px">↑</button>
            <button class="btn btn-icon btn-ghost btn-sm de-down" data-i="${i}" style="opacity:${i===this._questions.length-1?.35:1};padding:4px">↓</button>
          </div>
          <button class="item-delete de-del" data-i="${i}" style="opacity:1;position:static;width:28px;height:28px;border-radius:50%;border:none;background:transparent;color:var(--text-3);cursor:pointer;display:flex;align-items:center;justify-content:center">
            ${Icons.trash}
          </button>
        </div>`;
    }).join('');

    container.querySelectorAll('.de-del').forEach(btn => {
      btn.addEventListener('click', () => { this._questions.splice(+btn.dataset.i,1); this._renderQuestionList(); });
    });
    container.querySelectorAll('.de-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        if (i > 0) { [this._questions[i-1], this._questions[i]] = [this._questions[i], this._questions[i-1]]; this._renderQuestionList(); }
      });
    });
    container.querySelectorAll('.de-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        if (i < this._questions.length-1) { [this._questions[i], this._questions[i+1]] = [this._questions[i+1], this._questions[i]]; this._renderQuestionList(); }
      });
    });
  },

  _qBadgeHTML(q) {
    if (q.type === 'color_rank')    return `<span style="font-size:12px;color:var(--text-3)">Набор: ${q.colorSet} · Топ ${q.rankCount}</span>`;
    if (q.type === 'color_pick')    return `<span style="font-size:12px;color:var(--text-3)">Набор: ${q.colorSet} · ${q.pickMode==='multi'?'Несколько':'Один'}</span>`;
    if (q.type === 'face_pick')     return `<span style="font-size:12px;color:var(--text-3)">Набор: ${q.faceSet}</span>`;
    if (q.type === 'ladder')        return `<span style="font-size:12px;color:var(--text-3)">${q.steps} ступеней · «${q.topLabel}» / «${q.botLabel}»</span>`;
    if (q.type === 'shape_pick')    return `<span style="font-size:12px;color:var(--text-3)">Набор: ${q.shapeSet}</span>`;
    if (q.type === 'image_choice')  return `<span style="font-size:12px;color:var(--text-3)">${q.images?.length || 0} изображений</span>`;
    if (q.options?.length)          return `<span style="font-size:12px;color:var(--text-3)">${q.options.join(' · ')}</span>`;
    return '';
  },

  _renderSidebar() {
    const sb = document.getElementById('de-sidebar');
    if (!sb) return;
    sb.innerHTML = `
      <div class="editor-section-title">Популярные методики</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[
          ['🎨','Тест Люшера','8 цветов → ранжирование предпочтений','color_rank'],
          ['😊','Тревожность Тэммл-Дорки','Ситуации + выбор лица','face_pick'],
          ['🪜','Лесенка Щур','Самооценка — ступенька от 1 до 7','ladder'],
          ['🔷','Геометрия личности','Выбор предпочитаемой фигуры','shape_pick'],
          ['🖌️','ЦТО (Люшер-Эткинд)','Цвет → понятие/ощущение','color_pick'],
        ].map(([icon,name,desc,type]) => `
          <div style="background:var(--surface-2);border-radius:var(--r-md);padding:10px 12px;cursor:pointer;transition:background .15s;border:1px solid transparent"
            class="method-hint" data-type="${type}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span>${icon}</span>
              <span style="font-size:12.5px;font-weight:700;color:var(--text-1)">${name}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-3);line-height:1.4">${desc}</div>
          </div>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="editor-section-title">Итого</div>
      <div style="font-size:13px;color:var(--text-2)">
        Всего вопросов: <b>${this._questions.length}</b><br>
        Визуальных: <b>${this._questions.filter(q=>!['likert','yesno','choice','text'].includes(q.type)).length}</b><br>
        Текстовых: <b>${this._questions.filter(q=>['likert','yesno','choice','text'].includes(q.type)).length}</b>
      </div>`;

    // Клик по методике — переключает на нужный тип в форме
    sb.querySelectorAll('.method-hint').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.type;
        this._addTab = ['likert','yesno','choice','text'].includes(key) ? 'text' : 'visual';
        this._renderMain();
        // Выбрать тайл
        setTimeout(() => {
          const tile = document.querySelector(`.vtype-tile[data-key="${key}"]`);
          if (tile) { tile.click(); tile.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        }, 50);
      });
    });
  },
};
