// ══════════════════════════════════════════════════════════════════════════════
//  КОНСТРУКТОР ДИАГНОСТИК v3 — пошаговый мастер
//  Шаг 1: Элементы  |  Шаг 2: Веса (опц.)  |  Шаг 3: Итоги (опц.)
// ══════════════════════════════════════════════════════════════════════════════

const ELEM_TYPES = [
  { key: 'question',    icon: '❓', label: 'Вопрос',     desc: 'Ребёнок выбирает ответ из вариантов' },
  { key: 'observation', icon: '👁',  label: 'Наблюдение', desc: 'Педагог отмечает наличие признака' },
  { key: 'number',      icon: '🔢', label: 'Число',      desc: 'Вводится числовой результат субтеста' },
  { key: 'info',        icon: '📄', label: 'Пояснение',  desc: 'Текстовый блок без ответа' },
];

const ANS_TYPES = [
  { key: 'variants', label: 'Свои варианты' },
  { key: 'scale',    label: 'Шкала' },
  { key: 'yesno',    label: 'Да / Нет' },
];

const LEVEL_OPTIONS = [
  { key: 'norm',      label: 'Норма',                color: 'var(--green)',  bg: 'var(--green-l)' },
  { key: 'attention', label: 'Обратить внимание',    color: 'var(--amber)',  bg: 'var(--amber-l)' },
  { key: 'risk',      label: 'Требует консультации', color: 'var(--rose)',   bg: 'var(--rose-l)'  },
  { key: 'none',      label: 'Без уровня',           color: 'var(--text-3)', bg: 'var(--surface-2)' },
];

// ══════════════════════════════════════════════════════════════════════════════

const DiagEditor = {
  _el:              null,
  _diag:            null,
  _data:            null,
  _onSave:          null,
  _step:            1,
  _addForm:         null,
  _currentInterpTab: 'total',

  // ── Публичный API ────────────────────────────────────────────────────────
  async open(diagId, onSave) {
    if (!diagId || isNaN(diagId)) { toast('Ошибка: некорректный ID', 'error'); return; }
    let d;
    try { d = await window.db.diagnostics.get(diagId); }
    catch(e) { toast('Ошибка загрузки', 'error'); console.error('[DiagEditor]', e); return; }
    if (!d) { toast('Диагностика не найдена', 'error'); return; }

    this._diag   = d;
    this._onSave = onSave;
    this._step   = 1;
    this._addForm = null;
    this._currentInterpTab = 'total';

    try {
      const raw = JSON.parse(d.questions || 'null');
      this._data = (raw && raw.version === 2)
        ? raw
        : { version: 2, elements: [], subscales: [], interpretation: null };
    } catch(e) {
      this._data = { version: 2, elements: [], subscales: [], interpretation: null };
    }

    this._render();
  },

  close() { this._el?.remove(); this._el = null; },

  async _save() {
    try {
      await window.db.diagnostics.update({ ...this._diag, questions: this._data });
      toast('Сохранено', 'success');
      this._onSave?.();
      this.close();
    } catch(e) { toast('Ошибка сохранения', 'error'); console.error('[DiagEditor]', e); }
  },

  // ── Главный рендер ───────────────────────────────────────────────────────
  _render() {
    this._el?.remove();
    const el = document.createElement('div');
    el.className = 'editor-overlay';
    document.body.appendChild(el);
    this._el = el;
    this._renderShell();
    this._renderCurrentStep();
  },

  _renderShell() {
    const d = this._diag;
    const fillLabel = { teacher: 'Педагог', student: 'Ученик', parent: 'Родитель' }[d.fill_by] || d.fill_by;
    const stepNames = ['Элементы', 'Веса', 'Итоги'];

    this._el.innerHTML = `
      <div class="editor-topbar">
        <button class="btn btn-ghost btn-sm" id="de-close">${Icons.back} Назад</button>
        <div class="editor-title">${escHtml(d.name)}</div>
        <span class="editor-type-badge" style="background:var(--teal-l);color:var(--teal)">${fillLabel}</span>

        <div style="display:flex;align-items:center;gap:0;margin-left:auto">
          ${stepNames.map((s, i) => {
            const n = i + 1, done = n < this._step, cur = n === this._step;
            return `
              ${i > 0 ? `<div style="width:24px;height:2px;background:${done ? 'var(--indigo)' : 'var(--border)'}"></div>` : ''}
              <div class="de-step-nav" data-step="${n}" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:20px;cursor:pointer;
                   background:${cur ? 'var(--indigo-l)' : 'transparent'};
                   color:${cur ? 'var(--indigo)' : done ? 'var(--green)' : 'var(--text-3)'};transition:background .15s">
                <div style="width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;flex-shrink:0;
                     display:flex;align-items:center;justify-content:center;
                     background:${cur ? 'var(--indigo)' : done ? 'var(--green)' : 'var(--surface-2)'};
                     color:${(cur || done) ? '#fff' : 'var(--text-3)'}">${done ? '✓' : n}</div>
                <span style="font-size:12.5px;font-weight:${cur ? '700' : '500'}">${s}</span>
              </div>`;
          }).join('')}
        </div>

        <div style="display:flex;gap:8px;margin-left:16px">
          ${this._step > 1 ? `<button class="btn btn-ghost btn-sm" id="de-prev">← Назад</button>` : ''}
          ${this._step < 3
            ? `<button class="btn btn-primary btn-sm" id="de-next">Далее →</button>`
            : `<button class="btn btn-success" id="de-save-btn">Сохранить</button>`}
        </div>
      </div>
      <div id="de-body" style="flex:1;overflow-y:auto;padding:28px 36px"></div>`;

    this._el.querySelector('#de-close').addEventListener('click', () => this.close());
    this._el.querySelectorAll('.de-step-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = +btn.dataset.step;
        if (n <= this._step) this._goStep(n);
      });
    });
    this._el.querySelector('#de-prev')?.addEventListener('click', () => this._goStep(this._step - 1));
    this._el.querySelector('#de-next')?.addEventListener('click', () => this._goStep(this._step + 1));
    this._el.querySelector('#de-save-btn')?.addEventListener('click', () => {
      this._collectInterpretation();
      this._save();
    });
  },

  _goStep(n) {
    if (this._step === 2) this._collectWeights();
    if (this._step === 3) this._collectInterpretation();
    this._step = Math.max(1, Math.min(3, n));
    this._renderShell();
    this._renderCurrentStep();
  },

  _renderCurrentStep() {
    if (this._step === 1) this._renderStep1();
    else if (this._step === 2) this._renderStep2();
    else if (this._step === 3) this._renderStep3();
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ШАГ 1 — ЭЛЕМЕНТЫ
  // ══════════════════════════════════════════════════════════════════════════
  _renderStep1() {
    const body = document.getElementById('de-body');
    if (!body) return;
    const count = this._data.elements.length;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 420px;gap:28px">

        <div>
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:18px">
            <div style="font-size:18px;font-weight:700;color:var(--text-1)">Элементы</div>
            <div style="font-size:13px;color:var(--text-3)" id="de-el-count">${count} ${this._plEl(count)}</div>
          </div>
          <div id="de-el-list"></div>
        </div>

        <div style="position:sticky;top:0;align-self:start">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:22px">
            <div style="font-size:12.5px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">
              Добавить элемент
            </div>
            <div id="de-add-inner"></div>
          </div>
        </div>

      </div>`;

    this._renderElementList();
    this._renderAddForm();
  },

  _renderElementList() {
    const c = document.getElementById('de-el-list');
    if (!c) return;
    const cnt = document.getElementById('de-el-count');
    const els = this._data.elements;
    if (cnt) cnt.textContent = `${els.length} ${this._plEl(els.length)}`;

    if (!els.length) {
      c.innerHTML = `<div style="text-align:center;padding:48px 20px;background:var(--surface);border:2px dashed var(--border);border-radius:var(--r-xl);color:var(--text-3)">
        <div style="font-size:36px;margin-bottom:10px">📋</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-2);margin-bottom:4px">Нет элементов</div>
        <div style="font-size:13px">Добавьте первый элемент справа</div>
      </div>`;
      return;
    }

    c.innerHTML = els.map((el, i) => {
      const ti  = ELEM_TYPES.find(t => t.key === el.type) || ELEM_TYPES[0];
      const txt = el.stimulus?.text || '';
      const preview = txt ? escHtml(txt.slice(0, 75)) + (txt.length > 75 ? '…' : '') : `<span style="font-style:italic;color:var(--text-3)">Без текста</span>`;
      let badge = '';
      if (el.answer?.type === 'variants') badge = `${el.answer.options?.length || 0} вар.`;
      else if (el.answer?.type === 'scale') badge = `Шкала ${el.answer.scaleSteps || 4}`;
      else if (el.answer?.type === 'yesno') badge = 'Да/Нет';
      else if (el.answer?.type === 'checkbox') badge = 'Есть/Нет';
      else if (el.answer?.type === 'number') badge = 'Число';
      const weighted = el.weight?.scores?.some(s => s !== 0);

      return `<div class="item-card" style="margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">
        <div class="item-number" style="flex-shrink:0;margin-top:1px">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">
            <span style="font-size:15px">${ti.icon}</span>
            <span style="font-size:11.5px;font-weight:700;color:var(--indigo);background:var(--indigo-l);padding:2px 7px;border-radius:10px">${ti.label}</span>
            ${badge ? `<span style="font-size:11.5px;color:var(--text-3)">${badge}</span>` : ''}
            ${weighted ? `<span style="font-size:11px;color:var(--teal);background:var(--teal-l);padding:1px 7px;border-radius:10px">Взвешен</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--text-1);line-height:1.5">${preview}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
          <button class="btn btn-icon btn-ghost btn-sm de-up" data-i="${i}" style="padding:3px;opacity:${i===0?.3:1}" ${i===0?'disabled':''}>↑</button>
          <button class="btn btn-icon btn-ghost btn-sm de-dn" data-i="${i}" style="padding:3px;opacity:${i===els.length-1?.3:1}" ${i===els.length-1?'disabled':''}>↓</button>
        </div>
        <button class="item-delete de-del" data-i="${i}" style="position:static;width:26px;height:26px;border-radius:50%;border:none;background:transparent;color:var(--text-3);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">${Icons.trash}</button>
      </div>`;
    }).join('');

    c.querySelectorAll('.de-del').forEach(b => b.addEventListener('click', () => {
      this._data.elements.splice(+b.dataset.i, 1);
      this._renderElementList();
    }));
    c.querySelectorAll('.de-up').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (i > 0) { [this._data.elements[i-1], this._data.elements[i]] = [this._data.elements[i], this._data.elements[i-1]]; this._renderElementList(); }
    }));
    c.querySelectorAll('.de-dn').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (i < this._data.elements.length - 1) { [this._data.elements[i], this._data.elements[i+1]] = [this._data.elements[i+1], this._data.elements[i]]; this._renderElementList(); }
    }));
  },

  _renderAddForm() {
    const c = document.getElementById('de-add-inner');
    if (!c) return;
    if (!this._addForm) this._addForm = { type: 'question', ansType: 'yesno', stimText: '', options: 'Никогда\nИногда\nЧасто\nВсегда', scaleSteps: 4, scaleTop: 'Всегда', scaleBot: 'Никогда', numMin: 0, numMax: 10 };
    const f = this._addForm;
    const isInfo = f.type === 'info', isObs = f.type === 'observation', isNum = f.type === 'number', isQ = f.type === 'question';

    c.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${ELEM_TYPES.map(t => `
          <div class="de-type-tile" data-type="${t.key}"
            style="padding:9px 11px;border:2px solid ${f.type===t.key?'var(--indigo)':'var(--border)'};border-radius:var(--r-md);cursor:pointer;transition:all .15s;
                   background:${f.type===t.key?'var(--indigo-l)':'var(--surface)'}">
            <div style="font-size:16px;margin-bottom:2px">${t.icon}</div>
            <div style="font-size:12px;font-weight:700;color:${f.type===t.key?'var(--indigo)':'var(--text-1)'}">${t.label}</div>
            <div style="font-size:11px;color:var(--text-3);line-height:1.3">${t.desc}</div>
          </div>`).join('')}
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">${isInfo ? 'Текст пояснения' : 'Текст / вопрос (опционально)'}</label>
        <textarea class="input-field" id="de-f-text" style="height:${isInfo?'90':'56'}px;resize:vertical"
          placeholder="${isInfo ? 'Введите текст...' : 'Например: Ребёнок беспокоится перед школой?'}">${escHtml(f.stimText)}</textarea>
      </div>

      ${isQ ? `
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Тип ответа</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${ANS_TYPES.map(a => `
              <button class="de-at-btn" data-ans="${a.key}"
                style="padding:6px 12px;border-radius:var(--r-md);border:2px solid ${f.ansType===a.key?'var(--indigo)':'var(--border)'};
                       background:${f.ansType===a.key?'var(--indigo-l)':'var(--surface)'};color:${f.ansType===a.key?'var(--indigo)':'var(--text-2)'};
                       font-family:var(--font-ui);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s">
                ${a.label}
              </button>`).join('')}
          </div>
        </div>

        ${f.ansType === 'variants' ? `
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Варианты (каждый с новой строки)</label>
            <textarea class="input-field" id="de-f-opts" style="height:76px;resize:vertical">${escHtml(f.options)}</textarea>
          </div>` : ''}

        ${f.ansType === 'scale' ? `
          <div style="display:grid;grid-template-columns:56px 1fr 1fr;gap:8px;margin-bottom:12px;align-items:end">
            <div class="form-group">
              <label class="form-label">Шагов</label>
              <input class="input-field" id="de-f-steps" type="number" min="2" max="10" value="${f.scaleSteps}" style="text-align:center">
            </div>
            <div class="form-group">
              <label class="form-label">Метка слева</label>
              <input class="input-field" id="de-f-sbot" value="${escHtml(f.scaleBot)}" placeholder="Никогда">
            </div>
            <div class="form-group">
              <label class="form-label">Метка справа</label>
              <input class="input-field" id="de-f-stop" value="${escHtml(f.scaleTop)}" placeholder="Всегда">
            </div>
          </div>` : ''}` : ''}

      ${isNum ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div class="form-group"><label class="form-label">Мин.</label>
            <input class="input-field" id="de-f-nmin" type="number" value="${f.numMin}"></div>
          <div class="form-group"><label class="form-label">Макс.</label>
            <input class="input-field" id="de-f-nmax" type="number" value="${f.numMax}"></div>
        </div>` : ''}

      <button class="btn btn-primary" style="width:100%;margin-top:4px" id="de-add-btn">${Icons.plus} Добавить</button>`;

    c.querySelectorAll('.de-type-tile').forEach(t => t.addEventListener('click', () => {
      this._saveForm(); this._addForm.type = t.dataset.type; this._renderAddForm();
    }));
    c.querySelectorAll('.de-at-btn').forEach(b => b.addEventListener('click', () => {
      this._saveForm(); this._addForm.ansType = b.dataset.ans; this._renderAddForm();
    }));
    c.querySelector('#de-add-btn').addEventListener('click', () => { this._saveForm(); this._commitAdd(); });
  },

  _saveForm() {
    if (!this._addForm) return;
    const f = this._addForm;
    const v = id => document.getElementById(id)?.value;
    if (v('de-f-text') !== undefined) f.stimText   = v('de-f-text');
    if (v('de-f-opts') !== undefined) f.options    = v('de-f-opts');
    if (v('de-f-sbot') !== undefined) f.scaleBot   = v('de-f-sbot');
    if (v('de-f-stop') !== undefined) f.scaleTop   = v('de-f-stop');
    if (v('de-f-steps') !== undefined) f.scaleSteps = parseInt(v('de-f-steps')) || f.scaleSteps;
    if (v('de-f-nmin') !== undefined) f.numMin     = parseFloat(v('de-f-nmin')) || 0;
    if (v('de-f-nmax') !== undefined) f.numMax     = parseFloat(v('de-f-nmax')) || 0;
  },

  _commitAdd() {
    const f = this._addForm;
    if (f.type === 'info' && !f.stimText.trim()) { toast('Введите текст пояснения', 'error'); return; }

    const elem = {
      id:       `e${Date.now()}`,
      type:     f.type,
      stimulus: f.stimText.trim() ? { text: f.stimText.trim(), image: null } : null,
      answer:   null,
      weight:   null,
    };

    if (f.type === 'question') {
      if (f.ansType === 'variants') {
        const opts = f.options.split('\n').map(s => s.trim()).filter(Boolean);
        if (opts.length < 2) { toast('Добавьте минимум 2 варианта', 'error'); return; }
        elem.answer = { type: 'variants', options: opts };
      } else if (f.ansType === 'scale') {
        const n = Math.max(2, Math.min(10, f.scaleSteps || 4));
        elem.answer = {
          type: 'scale', scaleSteps: n,
          options: Array.from({ length: n }, (_, i) => i === 0 ? (f.scaleBot || '0') : i === n-1 ? (f.scaleTop || String(n-1)) : String(i)),
          scaleBot: f.scaleBot, scaleTop: f.scaleTop,
        };
      } else {
        elem.answer = { type: 'yesno', options: ['Нет', 'Да'] };
      }
    } else if (f.type === 'observation') {
      elem.answer = { type: 'checkbox', options: ['Нет', 'Есть'] };
    } else if (f.type === 'number') {
      elem.answer = { type: 'number', min: f.numMin, max: f.numMax };
    }

    this._data.elements.push(elem);
    this._addForm = { type: 'question', ansType: 'yesno', stimText: '', options: 'Никогда\nИногда\nЧасто\nВсегда', scaleSteps: 4, scaleTop: 'Всегда', scaleBot: 'Никогда', numMin: 0, numMax: 10 };
    this._renderElementList();
    this._renderAddForm();
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ШАГ 2 — ВЕСА
  // ══════════════════════════════════════════════════════════════════════════
  _renderStep2() {
    const body = document.getElementById('de-body');
    if (!body) return;
    const scorable = this._getScorableElements();

    if (!scorable.length) {
      body.innerHTML = `<div style="max-width:540px;margin:48px auto;text-align:center">
        <div style="font-size:44px;margin-bottom:12px">⚖️</div>
        <div style="font-size:18px;font-weight:700;color:var(--text-1);margin-bottom:8px">Нет элементов с ответами</div>
        <div style="font-size:14px;color:var(--text-3);margin-bottom:24px;line-height:1.6">
          Вернитесь и добавьте вопросы или наблюдения,<br>или перейдите к следующему шагу.
        </div>
        <button class="btn btn-ghost" id="s2-back">← К элементам</button>
      </div>`;
      body.querySelector('#s2-back').addEventListener('click', () => this._goStep(1));
      return;
    }

    const useSub = (this._data.subscales?.length > 0);

    body.innerHTML = `
      <div style="max-width:920px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:18px;font-weight:700;color:var(--text-1)">Веса ответов</div>
            <div style="font-size:13px;color:var(--text-3);margin-top:2px">Укажите баллы за каждый ответ. Можно оставить 0.</div>
          </div>
          <label style="display:flex;align-items:center;gap:9px;cursor:pointer;padding:9px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg)">
            <input type="checkbox" id="de-sub-on" ${useSub?'checked':''} style="width:15px;height:15px;accent-color:var(--indigo)">
            <span style="font-size:13px;font-weight:600;color:var(--text-1)">Подшкалы</span>
          </label>
        </div>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);overflow:auto" id="de-wt-wrap">
        </div>

        <div style="margin-top:14px;padding:14px 18px;background:var(--indigo-l);border-radius:var(--r-lg);display:flex;align-items:center;justify-content:space-between" id="de-range-bar">
        </div>

        <button class="btn btn-ghost btn-sm" id="de-skip-w" style="margin-top:10px;color:var(--text-3)">
          Пропустить — результат будет анкетным
        </button>
      </div>`;

    this._renderWeightTable(scorable, useSub);
    this._updateRangeBar(scorable);

    body.querySelector('#de-sub-on').addEventListener('change', e => {
      this._collectWeightsQuiet();
      if (!e.target.checked) this._data.subscales = [];
      this._renderWeightTable(this._getScorableElements(), e.target.checked);
    });

    body.querySelector('#de-skip-w').addEventListener('click', () => {
      this._data.elements.forEach(el => { el.weight = null; });
      this._data.subscales = [];
      this._goStep(3);
    });
  },

  _renderWeightTable(scorable, useSub) {
    const wrap = document.getElementById('de-wt-wrap');
    if (!wrap) return;

    wrap.innerHTML = `<table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--surface-2)">
        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:var(--text-3);border-bottom:1px solid var(--border);min-width:200px">Элемент</th>
        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:var(--text-3);border-bottom:1px solid var(--border)">Баллы за ответ</th>
        ${useSub ? `<th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:var(--text-3);border-bottom:1px solid var(--border);min-width:140px">Подшкала</th>` : ''}
        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:var(--text-3);border-bottom:1px solid var(--border);width:70px">Инв.</th>
      </tr></thead>
      <tbody id="de-wt-body"></tbody>
    </table>`;

    const tbody = document.getElementById('de-wt-body');
    scorable.forEach(el => {
      const opts   = el.answer.type === 'number' ? null : (el.answer.options || []);
      const w      = el.weight || { scores: opts ? opts.map(() => 0) : [], subscale: null, invert: false };
      const isNum  = el.answer.type === 'number';
      const label  = el.stimulus?.text?.slice(0, 70) || `(${ELEM_TYPES.find(t=>t.key===el.type)?.label || el.type})`;

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      tr.innerHTML = `
        <td style="padding:12px 16px;font-size:12.5px;color:var(--text-1);vertical-align:middle;line-height:1.5">${escHtml(label)}${label.length > 70 ? '…' : ''}</td>
        <td style="padding:12px 16px;vertical-align:middle">
          ${isNum
            ? `<div style="font-size:12px;color:var(--text-3);text-align:center">значение суммируется напрямую</div>`
            : `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                ${opts.map((opt, oi) => `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                    <div style="font-size:11px;color:var(--text-3);max-width:64px;text-align:center;line-height:1.3">${escHtml(opt)}</div>
                    <input type="number" class="input-field de-wi" data-eid="${el.id}" data-oi="${oi}" value="${w.scores?.[oi] ?? 0}"
                      style="width:54px;text-align:center;padding:5px;font-size:13px;font-weight:600">
                  </div>`).join('')}
               </div>`}
        </td>
        ${useSub ? `<td style="padding:12px 16px;vertical-align:middle">
          <input class="input-field de-ws" data-eid="${el.id}" placeholder="Шкала..." value="${escHtml(w.subscale||'')}" style="font-size:12px;padding:6px 9px">
        </td>` : ''}
        <td style="padding:12px 16px;vertical-align:middle;text-align:center">
          <button class="de-winv" data-eid="${el.id}" title="Инвертировать"
            style="padding:5px 9px;border-radius:var(--r-md);border:2px solid ${w.invert?'var(--indigo)':'var(--border)'};
                   background:${w.invert?'var(--indigo-l)':'var(--surface)'};color:${w.invert?'var(--indigo)':'var(--text-3)'};
                   font-size:13px;cursor:pointer;font-family:var(--font-ui);font-weight:700;transition:all .15s">↔</button>
        </td>`;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.de-winv').forEach(btn => {
      btn.addEventListener('click', () => {
        this._collectWeightsQuiet();
        const el = this._data.elements.find(e => e.id === btn.dataset.eid);
        if (el) {
          if (!el.weight) el.weight = { scores: [], subscale: null, invert: false };
          el.weight.invert = !el.weight.invert;
          if (el.weight.scores?.length) el.weight.scores = [...el.weight.scores].reverse();
        }
        this._renderWeightTable(this._getScorableElements(), document.getElementById('de-sub-on')?.checked);
        this._updateRangeBar(this._getScorableElements());
      });
    });

    tbody.querySelectorAll('.de-wi').forEach(inp => {
      inp.addEventListener('input', () => { this._collectWeightsQuiet(); this._updateRangeBar(this._getScorableElements()); });
    });
  },

  _collectWeights() {
    this._collectWeightsQuiet();
    const subs = new Set();
    this._data.elements.forEach(el => { if (el.weight?.subscale) subs.add(el.weight.subscale); });
    this._data.subscales = Array.from(subs);
  },

  _collectWeightsQuiet() {
    const body = document.getElementById('de-body');
    if (!body) return;
    body.querySelectorAll('.de-wi').forEach(inp => {
      const el = this._data.elements.find(e => e.id === inp.dataset.eid);
      if (!el) return;
      if (!el.weight) el.weight = { scores: [], subscale: null, invert: false };
      if (!el.weight.scores) el.weight.scores = [];
      el.weight.scores[+inp.dataset.oi] = parseFloat(inp.value) || 0;
    });
    body.querySelectorAll('.de-ws').forEach(inp => {
      const el = this._data.elements.find(e => e.id === inp.dataset.eid);
      if (el?.weight) el.weight.subscale = inp.value.trim() || null;
    });
  },

  _updateRangeBar(scorable) {
    const bar = document.getElementById('de-range-bar');
    if (!bar) return;
    const { min, max } = this._calcScoreRange();
    bar.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--indigo)">Возможный диапазон суммы: <b>${min} — ${max}</b></div>
      <div style="font-size:12px;color:var(--indigo);opacity:.75">Используется для интерпретации на шаге 3</div>`;
  },

  _getScorableElements() {
    return this._data.elements.filter(el => el.answer && el.answer.type !== null && el.type !== 'info');
  },

  _calcScoreRange(subscale) {
    let min = 0, max = 0;
    this._getScorableElements()
      .filter(el => !subscale || el.weight?.subscale === subscale)
      .forEach(el => {
        if (el.answer?.type === 'number') { min += el.answer.min||0; max += el.answer.max||0; }
        else {
          const sc = el.weight?.scores || [];
          if (sc.length) { min += Math.min(...sc); max += Math.max(...sc); }
        }
      });
    return { min, max };
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ШАГ 3 — ИНТЕРПРЕТАЦИЯ
  // ══════════════════════════════════════════════════════════════════════════
  _renderStep3() {
    const body = document.getElementById('de-body');
    if (!body) return;

    const scorable   = this._getScorableElements();
    const hasWeights = scorable.some(el => el.weight?.scores?.some(s => s !== 0) || el.answer?.type === 'number');

    if (!hasWeights) {
      body.innerHTML = `<div style="max-width:540px;margin:48px auto;text-align:center">
        <div style="font-size:44px;margin-bottom:12px">📊</div>
        <div style="font-size:18px;font-weight:700;color:var(--text-1);margin-bottom:8px">Интерпретация не применима</div>
        <div style="font-size:14px;color:var(--text-3);margin-bottom:24px;line-height:1.6">
          Веса не назначены — методика сохранится как анкета.<br>
          Результат покажет ответы без подсчёта.
        </div>
        <button class="btn btn-success" id="s3-save-plain" style="font-size:14px;padding:11px 28px">Сохранить как анкету</button>
      </div>`;
      body.querySelector('#s3-save-plain').addEventListener('click', () => { this._data.interpretation = null; this._save(); });
      return;
    }

    if (!this._data.interpretation) this._data.interpretation = { ranges: [], subscaleRanges: {} };

    const { min, max } = this._calcScoreRange();
    const hasSubs = this._data.subscales?.length > 0;
    const tab = this._currentInterpTab || 'total';

    body.innerHTML = `
      <div style="max-width:680px">
        <div style="margin-bottom:20px">
          <div style="font-size:18px;font-weight:700;color:var(--text-1)">Интерпретация итогов</div>
          <div style="font-size:13px;color:var(--text-3);margin-top:3px">
            Диапазон суммы: <b>${min} — ${max}</b>${hasSubs ? ` · Подшкалы: ${this._data.subscales.join(', ')}` : ''}
          </div>
        </div>

        ${hasSubs ? `<div style="display:flex;gap:0;background:var(--surface-2);border-radius:var(--r-md);padding:3px;margin-bottom:20px;width:fit-content">
          <button class="de-itab ${tab==='total'?'active':''}" data-tab="total"
            style="padding:7px 14px;border:none;font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;border-radius:var(--r-sm);transition:all .15s;
                   background:${tab==='total'?'var(--surface)':'transparent'};color:${tab==='total'?'var(--text-1)':'var(--text-3)'}">Общий итог</button>
          ${this._data.subscales.map(s => `
            <button class="de-itab ${tab===s?'active':''}" data-tab="${escHtml(s)}"
              style="padding:7px 14px;border:none;font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;border-radius:var(--r-sm);transition:all .15s;
                     background:${tab===s?'var(--surface)':'transparent'};color:${tab===s?'var(--text-1)':'var(--text-3)'}">${escHtml(s)}</button>`).join('')}
        </div>` : ''}

        <div id="de-ranges"></div>

        <button class="btn btn-ghost" style="width:100%;border-style:dashed;margin-top:10px" id="de-add-r">
          ${Icons.plus} Добавить диапазон
        </button>

        <div style="display:flex;align-items:center;gap:10px;margin-top:20px">
          <button class="btn btn-ghost" id="de-skip-i" style="color:var(--text-3)">Пропустить — без интерпретации</button>
          <div style="flex:1"></div>
          <button class="btn btn-success" id="de-save-i" style="font-size:14px;padding:11px 28px">Сохранить методику</button>
        </div>
      </div>`;

    this._renderRanges(tab);

    body.querySelectorAll('.de-itab').forEach(btn => {
      btn.addEventListener('click', () => { this._collectInterpretation(); this._currentInterpTab = btn.dataset.tab; this._renderStep3(); });
    });
    body.querySelector('#de-add-r').addEventListener('click', () => {
      this._collectInterpretation();
      const target = tab === 'total' ? this._data.interpretation.ranges
        : (this._data.interpretation.subscaleRanges[tab] = this._data.interpretation.subscaleRanges[tab] || []);
      const last = target[target.length - 1];
      const { min: rMin, max: rMax } = tab === 'total' ? { min, max } : this._calcScoreRange(tab);
      target.push({ from: last ? last.to + 1 : rMin, to: rMax, label: '', level: 'norm' });
      this._renderRanges(tab);
    });
    body.querySelector('#de-skip-i').addEventListener('click', () => { this._data.interpretation = null; this._save(); });
    body.querySelector('#de-save-i').addEventListener('click', () => { this._collectInterpretation(); this._save(); });
  },

  _renderRanges(tab) {
    const c = document.getElementById('de-ranges');
    if (!c) return;
    const ranges = tab === 'total'
      ? (this._data.interpretation?.ranges || [])
      : (this._data.interpretation?.subscaleRanges?.[tab] || []);

    if (!ranges.length) {
      c.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-3);border:2px dashed var(--border);border-radius:var(--r-xl)">
        Нажмите «Добавить диапазон» ниже
      </div>`;
      return;
    }

    c.innerHTML = ranges.map((r, i) => {
      const lvl = LEVEL_OPTIONS.find(l => l.key === (r.level||'norm')) || LEVEL_OPTIONS[0];
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);margin-bottom:10px;overflow:hidden">

          <!-- Верхняя строка: диапазон + заголовок + маркер + удалить -->
          <div style="display:flex;gap:8px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border);background:var(--surface-2)">
            <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
              <input type="number" class="input-field de-rf" data-i="${i}" value="${r.from}"
                style="width:62px;text-align:center;padding:5px 6px;font-weight:700;font-size:14px">
              <span style="color:var(--text-3);font-size:13px">—</span>
              <input type="number" class="input-field de-rt" data-i="${i}" value="${r.to}"
                style="width:62px;text-align:center;padding:5px 6px;font-weight:700;font-size:14px">
            </div>
            <input class="input-field de-rl" data-i="${i}" value="${escHtml(r.label||'')}"
              placeholder="Заголовок результата (Норма, Высокий уровень тревожности...)"
              style="flex:1;padding:6px 10px;font-weight:600;font-size:13.5px">
            <select class="input-field select-field de-rv" data-i="${i}"
              style="padding:5px 28px 5px 9px;border-color:${lvl.color};color:${lvl.color};background:${lvl.bg};font-weight:700;min-width:160px;flex-shrink:0">
              ${LEVEL_OPTIONS.map(l => `<option value="${l.key}" ${r.level===l.key?'selected':''}>${l.label}</option>`).join('')}
            </select>
            <button class="btn btn-icon btn-ghost btn-sm de-rd" data-i="${i}" style="color:var(--rose);flex-shrink:0">${Icons.trash}</button>
          </div>

          <!-- Нижняя часть: полное описание -->
          <div style="padding:12px 14px">
            <label style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">
              Описание результата (показывается педагогу после прохождения)
            </label>
            <textarea class="input-field de-rdesc" data-i="${i}"
              placeholder="Опишите, что означает этот результат: на что обратить внимание, какие рекомендации дать, что обсудить с родителями..."
              style="height:80px;resize:vertical;font-size:13px;line-height:1.6">${escHtml(r.desc||'')}</textarea>
          </div>
        </div>`;
    }).join('');

    c.querySelectorAll('.de-rd').forEach(btn => {
      btn.addEventListener('click', () => {
        this._collectInterpretation();
        const target = tab === 'total' ? this._data.interpretation.ranges : this._data.interpretation.subscaleRanges[tab];
        target.splice(+btn.dataset.i, 1);
        this._renderRanges(tab);
      });
    });
    c.querySelectorAll('.de-rv').forEach(sel => {
      sel.addEventListener('change', () => { this._collectInterpretation(); this._renderRanges(tab); });
    });
  },

  _collectInterpretation() {
    const body = document.getElementById('de-body');
    if (!body || !this._data.interpretation) return;
    const tab = this._currentInterpTab || 'total';
    const target = tab === 'total'
      ? this._data.interpretation.ranges
      : (this._data.interpretation.subscaleRanges[tab] || []);

    body.querySelectorAll('[data-i]').forEach(el => {
      const i = +el.dataset.i;
      if (!target[i]) return;
      if (el.classList.contains('de-rf'))    target[i].from  = parseFloat(el.value) || 0;
      if (el.classList.contains('de-rt'))    target[i].to    = parseFloat(el.value) || 0;
      if (el.classList.contains('de-rl'))    target[i].label = el.value.trim();
      if (el.classList.contains('de-rv'))    target[i].level = el.value;
      if (el.classList.contains('de-rdesc')) target[i].desc  = el.value.trim();
    });
  },

  _plEl(n) {
    const m = n % 100, m1 = n % 10;
    if (m >= 11 && m <= 19) return 'элементов';
    if (m1 === 1) return 'элемент';
    if (m1 >= 2 && m1 <= 4) return 'элемента';
    return 'элементов';
  },
};
