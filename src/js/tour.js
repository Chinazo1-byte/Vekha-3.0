// ══════════════════════════════════════════════════════════════════════════════
//  ИНТЕРАКТИВНЫЙ ТУР — Веха
//  Запускается один раз при первом открытии каждого раздела.
//  Педагог может в любой момент перезапустить тур через «?» в шапке раздела.
// ══════════════════════════════════════════════════════════════════════════════

const Tour = {

  _overlay:   null,
  _tooltip:   null,
  _steps:     [],
  _idx:       0,
  _onDone:    null,
  _highlight: null,

  // ── Сценарии туров по разделам ───────────────────────────────────────────

  TOURS: {

    students: [
      {
        selector: '[data-page="students"]',
        anchor: 'sidebar',
        title: 'Раздел «Ученики»',
        text:  'Здесь хранится список всех ваших учеников. Это отправная точка: большинство действий в приложении — занятия, диагностики, отчёты — привязаны к конкретному ребёнку.',
        position: 'right',
      },
      {
        selector: '#btn-add-student',
        title: 'Добавить ученика',
        text:  'Начните с добавления учеников в список. Укажите имя, фамилию, дату рождения и класс — этого достаточно для начала работы.',
        position: 'bottom',
      },
      {
        selector: '.student-card, .item-card',
        title: 'Карточка ученика',
        text:  'Нажмите на карточку ученика, чтобы открыть его историю: все пройденные диагностики, результаты упражнений и PDF-отчёт. Данные копятся со временем и отражают динамику.',
        position: 'right',
        fallback: '#btn-add-student',
      },
      {
        selector: '#sidebar',
        anchor: 'sidebar-bottom',
        title: 'Экспорт и импорт',
        text:  'В разделе Настройки — экспорт и импорт библиотеки упражнений и методик. Удобно для переноса наработок между компьютерами или обмена с коллегами.',
        position: 'right',
      },
    ],

    exercises: [
      {
        selector: '[data-page="exercises"]',
        anchor: 'sidebar',
        title: 'Раздел «Упражнения»',
        text:  'Здесь хранится ваша библиотека упражнений — строительные блоки для занятий. Упражнения бывают 18 типов: от простых карточек до заданий на память, внимание и логику.',
        position: 'right',
      },
      {
        selector: '#btn-add-exercise',
        title: 'Создать упражнение',
        text:  'Нажмите «Создать», чтобы открыть редактор. Выберите тип упражнения, добавьте содержимое — текст, изображения, варианты ответов — и сохраните в библиотеку.',
        position: 'bottom',
      },
      {
        selector: '.exercise-filters, .filter-row, .categories-row',
        title: 'Категории и фильтры',
        text:  'Упражнения можно распределять по категориям: Внимание, Память, Логика, Речь — или создать свои. Фильтры помогают быстро находить нужное, когда библиотека разрастётся.',
        position: 'bottom',
        fallback: '#btn-add-exercise',
      },
      {
        selector: '.exercise-card, .item-card',
        title: 'Карточка упражнения',
        text:  'Нажмите на упражнение — откроется предпросмотр. Кнопка редактирования позволяет изменить содержимое в любой момент. Упражнения можно запускать отдельно или включать в занятие.',
        position: 'right',
        fallback: '#btn-add-exercise',
      },
    ],

    sessions: [
      {
        selector: '[data-page="sessions"]',
        anchor: 'sidebar',
        title: 'Раздел «Занятия»',
        text:  'Занятие — это набор упражнений, выстроенных в определённом порядке. Вы можете создать разовое занятие или шаблон, который будет использоваться снова и снова.',
        position: 'right',
      },
      {
        selector: '#btn-new-template',
        title: 'Создать шаблон занятия',
        text:  'Шаблон — это готовый сценарий. Составьте его один раз из упражнений библиотеки, задайте порядок и настройки — и запускайте с любым учеником без лишних шагов.',
        position: 'bottom',
      },
      {
        selector: '#btn-new-session',
        title: 'Разовое занятие',
        text:  'Если хотите быстро собрать занятие «на ходу» — используйте эту кнопку. Состав занятия можно менять перед каждым запуском.',
        position: 'bottom',
      },
      {
        selector: '.session-card, .item-card',
        title: 'Запуск занятия',
        text:  'Нажмите на занятие, выберите ученика и нажмите «Начать». Упражнения пойдут по очереди в полноэкранном режиме. Результаты автоматически сохранятся в карточке ученика.',
        position: 'right',
        fallback: '#btn-new-template',
      },
    ],

    diagnostics: [
      {
        selector: '[data-page="diagnostics"]',
        anchor: 'sidebar',
        title: 'Раздел «Диагностики»',
        text:  'Здесь собраны инструменты для психолого-педагогической оценки. Это отдельный инструмент от упражнений: диагностика измеряет, упражнение развивает.',
        position: 'right',
      },
      {
        selector: '.diag-builtin-section, .builtin-methods, .diag-section',
        title: 'Готовые методики',
        text:  'Встроенные методики — это валидированные инструменты: тест Люшера, Филлипса, социометрия и другие. Они уже настроены и готовы к запуску. Просто выберите ученика и нажмите «Провести».',
        position: 'bottom',
        fallback: '#btn-create-diag',
      },
      {
        selector: '#btn-create-diag',
        title: 'Создать свою методику',
        text:  'Конструктор методик работает в три шага: сначала вы добавляете вопросы и элементы, затем назначаете баллы каждому ответу, и наконец описываете что означает тот или иной результат.',
        position: 'bottom',
      },
      {
        selector: '.diag-card, .item-card',
        title: 'Запуск и результаты',
        text:  'После прохождения диагностики результат сохраняется в карточке ученика. Если вы задали интерпретацию — педагог сразу увидит заголовок и описание результата со всеми рекомендациями.',
        position: 'right',
        fallback: '#btn-create-diag',
      },
    ],

  },

  // ── Запуск тура ──────────────────────────────────────────────────────────

  async startIfNeeded(page) {
    this._currentPage = page;
    let done = false;
    try {
      // Сначала проверяем localStorage — быстро и надёжно
      if (localStorage.getItem(`tour_done_${page}`)) { done = true; }
      // Затем БД если доступна
      if (!done && typeof window.db?.settings?.get === 'function') {
        const val = await window.db.settings.get(`tour_done_${page}`);
        done = !!val;
      }
    } catch(e) {
      console.warn('[Tour] could not check tour state, starting anyway');
    }
    if (!done) this.start(page);
  },

  start(page, onDone) {
    const steps = this.TOURS[page];
    if (!steps?.length) return;
    this._steps  = steps;
    this._idx    = 0;
    this._onDone = onDone || (() => {});
    this._mount();
    this._showStep(0);
  },

  // ── DOM ──────────────────────────────────────────────────────────────────

  _mount() {
    this._unmount();

    // Затемняющий оверлей
    const ov = document.createElement('div');
    ov.id = 'tour-overlay';
    ov.style.cssText = `
      position:fixed;inset:0;z-index:9000;pointer-events:none;
      transition:opacity .25s;opacity:0;`;
    document.body.appendChild(ov);
    this._overlay = ov;

    // Тултип
    const tt = document.createElement('div');
    tt.id = 'tour-tooltip';
    tt.style.cssText = `
      position:fixed;z-index:9100;width:340px;
      background:var(--surface);border:1px solid var(--border);
      border-radius:var(--r-xl);box-shadow:0 20px 60px rgba(0,0,0,.25);
      opacity:0;transform:translateY(8px);
      transition:opacity .22s,transform .22s;pointer-events:all;`;
    document.body.appendChild(tt);
    this._tooltip = tt;

    requestAnimationFrame(() => { ov.style.opacity = '1'; });
  },

  _unmount() {
    this._clearHighlight();
    document.getElementById('tour-overlay')?.remove();
    document.getElementById('tour-tooltip')?.remove();
    this._overlay = null;
    this._tooltip = null;
  },

  // ── Шаги ─────────────────────────────────────────────────────────────────

  _showStep(idx) {
    const step = this._steps[idx];
    if (!step) { this._finish(); return; }

    this._idx = idx;
    const total = this._steps.length;

    // Найти целевой элемент
    let target = document.querySelector(step.selector);
    if (!target && step.fallback) target = document.querySelector(step.fallback);

    // Подсветить элемент
    this._clearHighlight();
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      this._applyHighlight(target);
    }

    // Контент тултипа
    const tt = this._tooltip;
    tt.style.opacity = '0';
    tt.style.transform = 'translateY(8px)';

    tt.innerHTML = `
      <div style="padding:22px 22px 0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;gap:5px">
            ${Array.from({length: total}, (_, i) => `
              <div style="width:${i===idx?18:6}px;height:6px;border-radius:3px;transition:width .2s;
                background:${i===idx?'var(--indigo)':i<idx?'var(--indigo-m,var(--indigo))':'var(--border)'}"></div>
            `).join('')}
          </div>
          <button id="tour-skip" style="background:none;border:none;cursor:pointer;font-size:12px;
            color:var(--text-3);font-family:var(--font-ui);padding:2px 6px;border-radius:4px;
            transition:color .15s" onmouseover="this.style.color='var(--text-2)'"
            onmouseout="this.style.color='var(--text-3)'">Пропустить тур</button>
        </div>
        <div style="font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:8px;line-height:1.3">
          ${escHtml(step.title)}
        </div>
        <div style="font-size:13.5px;color:var(--text-2);line-height:1.65;margin-bottom:20px">
          ${escHtml(step.text)}
        </div>
      </div>
      <div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px">
        ${idx > 0
          ? `<button id="tour-prev" style="background:none;border:1px solid var(--border);border-radius:var(--r-md);
               padding:7px 14px;cursor:pointer;font-family:var(--font-ui);font-size:13px;font-weight:600;
               color:var(--text-2);transition:all .15s">← Назад</button>`
          : ''}
        <div style="flex:1"></div>
        <div style="font-size:12px;color:var(--text-3)">${idx + 1} / ${total}</div>
        <button id="tour-next" style="background:var(--indigo);border:none;border-radius:var(--r-md);
          padding:8px 20px;cursor:pointer;font-family:var(--font-ui);font-size:13px;font-weight:700;
          color:#fff;transition:background .15s">
          ${idx < total - 1 ? 'Далее →' : 'Готово ✓'}
        </button>
      </div>`;

    // Позиционировать тултип
    if (target) {
      this._positionTooltip(tt, target, step.position || 'bottom');
    } else {
      // Центр экрана если элемент не найден
      tt.style.top  = '50%';
      tt.style.left = '50%';
      tt.style.transform = 'translate(-50%,-50%)';
    }

    // Показать
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tt.style.opacity  = '1';
        tt.style.transform = target ? 'translateY(0)' : 'translate(-50%,-50%) translateY(0)';
      });
    });

    // События
    tt.querySelector('#tour-next').addEventListener('click', () => {
      if (idx < total - 1) this._showStep(idx + 1);
      else this._finish();
    });
    tt.querySelector('#tour-prev')?.addEventListener('click', () => {
      this._showStep(idx - 1);
    });
    tt.querySelector('#tour-skip').addEventListener('click', () => {
      this._finish(true);
    });
  },

  _applyHighlight(el) {
    this._highlight = el;
    const saved = el.style.cssText;
    el.dataset.tourSaved = saved;
    el.style.position    = el.style.position || 'relative';
    el.style.zIndex      = '9050';
    el.style.borderRadius = el.style.borderRadius || 'var(--r-md)';
    el.style.boxShadow   = `0 0 0 4px var(--indigo), 0 0 0 9999px rgba(0,0,0,.5)`;
    el.style.transition  = 'box-shadow .2s';

    // Оверлей нужен только для блокировки кликов мимо
    if (this._overlay) this._overlay.style.background = 'transparent';
  },

  _clearHighlight() {
    if (!this._highlight) return;
    const el = this._highlight;
    el.style.zIndex     = '';
    el.style.boxShadow  = el.dataset.tourSaved
      ? (el.dataset.tourSaved.match(/box-shadow:[^;]+/)?.[0]?.replace('box-shadow:','') || '')
      : '';
    delete el.dataset.tourSaved;
    this._highlight = null;
  },

  _positionTooltip(tt, target, position) {
    const tr  = target.getBoundingClientRect();
    const gap = 14;
    const W   = window.innerWidth, H = window.innerHeight;
    const TW  = 340, TH = 220; // приблизительная высота тултипа

    tt.style.transform = 'translateY(0)';
    tt.style.left = '';
    tt.style.top  = '';
    tt.style.right = '';
    tt.style.bottom = '';

    let left, top;

    if (position === 'right' || (position === 'sidebar')) {
      left = tr.right + gap;
      top  = tr.top + tr.height / 2 - TH / 2;
    } else if (position === 'left') {
      left = tr.left - TW - gap;
      top  = tr.top + tr.height / 2 - TH / 2;
    } else if (position === 'top') {
      left = tr.left + tr.width / 2 - TW / 2;
      top  = tr.top - TH - gap;
    } else { // bottom
      left = tr.left + tr.width / 2 - TW / 2;
      top  = tr.bottom + gap;
    }

    // Не выходить за края экрана
    left = Math.max(12, Math.min(W - TW - 12, left));
    top  = Math.max(12, Math.min(H - TH - 12, top));

    tt.style.left = `${left}px`;
    tt.style.top  = `${top}px`;
  },

  // ── Завершение ───────────────────────────────────────────────────────────

  async _finish(skipped) {
    this._clearHighlight();

    const tt = this._tooltip;
    if (tt) {
      tt.style.opacity   = '0';
      tt.style.transform = 'translateY(8px)';
    }
    if (this._overlay) {
      this._overlay.style.opacity = '0';
    }

    setTimeout(() => this._unmount(), 300);

    // Определяем текущий раздел по активному nav-item
    const active = document.querySelector('.nav-item.active');
    const page   = active?.dataset?.page || this._currentPage;
    if (page) {
      const key = `tour_done_${page}`;
      // Сохраняем в БД если доступно, и в localStorage как запасной вариант
      try {
        if (typeof window.db?.settings?.set === 'function') {
          await window.db.settings.set(key, true);
        }
      } catch(e) {}
      try { localStorage.setItem(key, '1'); } catch(e) {}
    }

    this._onDone(skipped);
  },
};

// ── Кнопка «?» для ручного перезапуска тура ─────────────────────────────────

function injectTourButton(page) {
  const header = document.querySelector(`#page-${page} .page-header`);
  if (!header || header.querySelector('.tour-help-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-sm tour-help-btn';
  btn.title  = 'Показать подсказки по разделу';
  btn.style.cssText = 'margin-left:4px;padding:6px 10px;font-size:13px;color:var(--text-3);border-color:var(--border)';
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="10" cy="10" r="8"/>
      <path d="M10 14v-1M10 10c0-1.5 2-2 2-3.5a2 2 0 0 0-4 0"/>
    </svg>
    Подсказки`;
  btn.addEventListener('click', () => Tour.start(page));

  // Вставляем перед первой кнопкой в шапке
  const firstBtn = header.querySelector('.btn');
  if (firstBtn) header.insertBefore(btn, firstBtn);
  else header.appendChild(btn);
}
