// ══════════════════════════════════════════════════════════════════════════════
//  ПЛЕЕР ЦЕПОЧКИ ЗАНЯТИЙ
//  Запускает упражнения последовательно, показывает итоговый экран
// ══════════════════════════════════════════════════════════════════════════════

const SessionPlayer = {
  _el:        null,
  _session:   null,
  _student:   null,
  _exercises: [],
  _idx:       0,
  _results:   [],   // { exercise_id, correct, total, duration_sec }
  _startTime: null,

  async start(sessionId, studentId) {
    Sound.start();
    const session = await window.db.sessions.get(sessionId);
    if (!session) { toast('Занятие не найдено', 'error'); return; }

    let exIds = [];
    try { exIds = JSON.parse(session.exercise_ids || '[]'); } catch(e) {}
    if (!exIds.length) { toast('В занятии нет упражнений', 'error'); return; }

    // Загружаем все упражнения цепочки
    const all = await window.db.exercises.getAll();
    const exercises = exIds.map(id => all.find(e => e.id === id)).filter(Boolean);
    if (!exercises.length) { toast('Упражнения не найдены', 'error'); return; }

    const student = studentId ? await window.db.students.get(studentId) : null;

    this._session   = session;
    this._student   = student;
    this._exercises = exercises;
    this._idx       = 0;
    this._results   = [];
    this._startTime = Date.now();

    this._showIntro();
  },

  _showIntro() {
    this._el?.remove();
    const el = document.createElement('div');
    el.className = 'player-overlay';
    el.id = 'session-player-overlay';
    document.body.appendChild(el);
    this._el = el;

    const s = this._session;
    const student = this._student;

    el.innerHTML = `
      <div class="player-topbar">
        <button class="btn btn-ghost btn-sm" id="sp-close-intro">Закрыть</button>
        <div style="font-size:14px;font-weight:600;color:var(--text-2)">${escHtml(s.name)}</div>
        <div class="player-progress-bar"><div class="player-progress-fill" style="width:0%"></div></div>
        <div class="player-counter">0 / ${this._exercises.length}</div>
      </div>
      <div class="player-body">
        <div class="player-card" style="text-align:center;max-width:640px">
          <div style="font-size:44px;margin-bottom:16px">📚</div>
          <div style="font-family:var(--font-title);font-size:26px;font-weight:600;margin-bottom:8px">
            ${escHtml(s.name)}
          </div>
          ${student ? `
            <div style="font-size:14px;color:var(--text-3);margin-bottom:24px">
              Ученик: <b style="color:var(--text-1)">${escHtml(student.first_name)} ${escHtml(student.last_name || '')}</b>
            </div>` : '<div style="margin-bottom:24px"></div>'}

          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:32px;text-align:left;background:var(--surface-2);border-radius:var(--r-lg);padding:16px">
            ${this._exercises.map((ex, i) => {
              const m = exerciseTypeMeta(ex.type);
              return `<div style="display:flex;align-items:center;gap:10px;font-size:13.5px">
                <span style="width:22px;height:22px;border-radius:50%;background:var(--indigo-l);color:var(--indigo);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
                <span style="flex:1;font-weight:500">${escHtml(ex.name)}</span>
                <span style="font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:10px;background:${m.colorL};color:${m.color}">${m.label}</span>
              </div>`;
            }).join('')}
          </div>

          <button class="btn btn-primary" id="sp-start-btn" style="font-size:16px;padding:14px 36px">
            Начать занятие
          </button>
        </div>
      </div>`;

    el.querySelector('#sp-close-intro').addEventListener('click', () => this.close());
    el.querySelector('#sp-start-btn').addEventListener('click', () => this._runNext());
  },

  _runNext() {
    if (this._idx >= this._exercises.length) {
      this._showFinalResult();
      return;
    }

    const ex = this._exercises[this._idx];
    let content = {};
    try { content = JSON.parse(ex.content || '{}'); } catch(e) {}

    // Обновляем топбар
    this._el.innerHTML = spTopbar(
      this._session.name,
      this._idx + 1,
      this._exercises.length,
      ex.name
    );

    this._el.querySelector('#sp-close-btn')
      ?.addEventListener('click', () => this._confirmClose());
    this._el.querySelector('#sp-finish-early-btn')
      ?.addEventListener('click', () => this._confirmFinishEarly());

    // Запускаем нужный плеер внутри нашего оверлея
    const body = document.createElement('div');
    body.id = 'sp-exercise-body';
    body.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:auto';
    this._el.appendChild(body);

    // Используем SpTypes — адаптеры упражнений для режима цепочки
    const sessionDone = (r) => this._onExerciseDone(r);

    const ran = SpRunner.run(ex, content, body, sessionDone, () => this._confirmClose());
    if (!ran) {
      body.innerHTML = `
        <div class="player-body">
          <div class="player-card" style="text-align:center">
            <div style="font-size:17px;color:var(--text-3);margin-bottom:24px">
              Тип «${escHtml(exerciseTypeMeta(ex.type).label)}» пока не поддерживается в цепочке
            </div>
            <button class="btn btn-primary" id="sp-skip-btn">Пропустить</button>
          </div>
        </div>`;
      body.querySelector('#sp-skip-btn').addEventListener('click', () => {
        this._results.push({ exercise_id: ex.id, correct: 0, total: 0, duration_sec: 0 });
        this._idx++;
        this._runNext();
      });
    }
  },

  _onExerciseDone(result) {
    // result = { correct, total, duration_sec, answers }
    const ex = this._exercises[this._idx];
    this._results.push({ exercise_id: ex.id, ...result });

    // Сохраняем результат упражнения
    if (this._student) {
      window.db.exercises.saveResult({
        student_id:   this._student.id,
        exercise_id:  ex.id,
        correct:      result.correct,
        total:        result.total,
        score:        result.total > 0 ? Math.round(result.correct / result.total * 100) + '%' : '—',
        duration_sec: result.duration_sec,
        answers:      result.answers || [],
      });
    }

    this._idx++;

    if (this._idx >= this._exercises.length) {
      this._showFinalResult();
    } else {
      this._showBetween();
    }
  },

  _showBetween() {
    const next = this._exercises[this._idx];
    const prev = this._exercises[this._idx - 1];
    const last = this._results[this._results.length - 1];
    const pct  = last.total > 0 ? Math.round(last.correct / last.total * 100) : null;
    const m    = exerciseTypeMeta(next.type);

    this._el.innerHTML = spTopbar(
      this._session.name, this._idx + 1, this._exercises.length, next.name
    ) + `
      <div class="player-body">
        <div class="player-card" style="text-align:center;max-width:480px">
          ${pct !== null ? `
            <div style="font-size:42px;margin-bottom:4px">${pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
            <div style="font-family:var(--font-title);font-size:32px;font-weight:600;color:${pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--rose)'};margin-bottom:4px">
              ${pct}%
            </div>
            <div style="font-size:13.5px;color:var(--text-3);margin-bottom:24px">
              «${escHtml(prev.name)}» — правильно ${last.correct} из ${last.total}
            </div>` : `<div style="margin-bottom:24px"></div>`}

          <div style="background:var(--surface-2);border-radius:var(--r-lg);padding:16px 20px;margin-bottom:28px;text-align:left">
            <div style="font-size:11.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
              Следующее упражнение
            </div>
            <div style="font-size:15px;font-weight:600;color:var(--text-1);margin-bottom:4px">${escHtml(next.name)}</div>
            <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:10px;background:${m.colorL};color:${m.color}">${m.label}</span>
          </div>

          <button class="btn btn-primary" id="sp-continue-btn" style="font-size:15px;padding:12px 32px">
            Продолжить
          </button>
        </div>
      </div>`;

    this._el.querySelector('#sp-close-btn')?.addEventListener('click', () => this._confirmClose());
    this._el.querySelector('#sp-finish-early-btn')?.addEventListener('click', () => this._confirmFinishEarly());
    this._el.querySelector('#sp-continue-btn').addEventListener('click', () => { Sound.next(); this._runNext(); });
  },

  async _showFinalResult() {
    Sound.chainWin();
    const totalCorrect = this._results.reduce((s, r) => s + r.correct, 0);
    const totalItems   = this._results.reduce((s, r) => s + r.total, 0);
    const totalDur     = Math.round((Date.now() - this._startTime) / 1000);
    const pct          = totalItems > 0 ? Math.round(totalCorrect / totalItems * 100) : 0;
    const cls          = pct >= 80 ? 'great' : pct >= 50 ? 'ok' : 'low';
    const emoji        = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪';
    const msg          = pct >= 80 ? 'Отличная работа!' : pct >= 50 ? 'Хорошая работа!' : 'Продолжай стараться!';

    const durMin = Math.floor(totalDur / 60);
    const durSec = totalDur % 60;
    const durStr = durMin > 0 ? `${durMin} мин ${durSec} сек` : `${durSec} сек`;

    this._el.innerHTML = `
      <div class="player-topbar">
        <div style="font-size:15px;font-weight:600">Итог занятия</div>
      </div>
      <div class="player-body" style="overflow-y:auto">
        <div class="player-card" style="max-width:680px;width:100%">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:52px;margin-bottom:8px">${emoji}</div>
            <div class="result-score ${cls}">${pct}%</div>
            <div style="font-size:16px;color:var(--text-2);margin-top:6px">${msg}</div>
            ${this._student ? `
              <div style="font-size:13px;color:var(--text-3);margin-top:4px">
                ${escHtml(this._student.first_name)} ${escHtml(this._student.last_name||'')}
              </div>` : ''}
          </div>

          <div style="display:flex;gap:12px;margin-bottom:24px">
            <div class="stat-card" style="text-align:center">
              <div class="stat-value">${this._exercises.length}</div>
              <div class="stat-label">Упражнений</div>
            </div>
            <div class="stat-card" style="text-align:center">
              <div class="stat-value">${totalCorrect}/${totalItems}</div>
              <div class="stat-label">Правильно</div>
            </div>
            <div class="stat-card" style="text-align:center">
              <div class="stat-value">${durStr}</div>
              <div class="stat-label">Время</div>
            </div>
          </div>

          <div style="background:var(--surface-2);border-radius:var(--r-lg);padding:4px;margin-bottom:24px">
            ${this._results.map((r, i) => {
              const ex  = this._exercises[i];
              const p   = r.total > 0 ? Math.round(r.correct / r.total * 100) : null;
              const cls = p === null ? '' : p >= 80 ? 'score-high' : p >= 50 ? 'score-mid' : 'score-low';
              return `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border)">
                  <span style="width:22px;height:22px;border-radius:50%;background:var(--indigo);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
                  <span style="flex:1;font-size:13.5px;font-weight:500">${escHtml(ex?.name||'—')}</span>
                  ${p !== null
                    ? `<span class="score-pill ${cls}">${p}%</span>`
                    : `<span class="tag">—</span>`}
                </div>`;
            }).join('')}
          </div>

          <div style="display:flex;gap:10px;justify-content:center">
            <button class="btn btn-ghost" id="sp-final-close">Закрыть</button>
          </div>
        </div>
      </div>`;

    this._el.querySelector('#sp-final-close').addEventListener('click', () => this.close());
  },

  _confirmFinishEarly() {
    const done = this._results.length;
    const total = this._exercises.length;
    if (done === 0) {
      // Ничего не выполнено — просто закрыть
      this._confirmClose();
      return;
    }
    Modal.confirm(
      'Завершить занятие досрочно?',
      `Выполнено ${done} из ${total} упражнений. Результаты будут сохранены.`,
      () => this._showFinalResult(), 'Завершить', false
    );
  },

  _confirmClose() {
    Modal.confirm(
      'Прервать занятие?',
      'Прогресс текущего упражнения будет потерян. Уже выполненные упражнения сохранены.',
      () => this.close(), 'Прервать', false
    );
  },

  close() {
    this._el?.remove();
    this._el = null;
  },
};

// ── Топбар цепочки ────────────────────────────────────────────────────────────
function spTopbar(sessionName, current, total, exName) {
  const pct = Math.round((current - 1) / total * 100);
  return `
    <div class="player-topbar">
      <button class="btn btn-ghost btn-sm" id="sp-close-btn" title="Закрыть">✕</button>
      <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
        <div style="font-size:11.5px;color:var(--text-3);font-weight:500">${escHtml(sessionName)}</div>
        <div style="font-size:13.5px;font-weight:600;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(exName)}</div>
      </div>
      <div class="player-progress-bar">
        <div class="player-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="player-counter">${current} / ${total}</div>
      <button class="btn btn-ghost btn-sm" id="sp-finish-early-btn"
        style="font-size:12px;white-space:nowrap;color:var(--text-3);margin-left:6px"
        title="Завершить занятие досрочно и показать результаты">Завершить</button>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ТИПЫ УПРАЖНЕНИЙ ДЛЯ ЦЕПОЧКИ
//  Идентичны PlayerTypes, но принимают container и onDone(result)
// ══════════════════════════════════════════════════════════════════════════════
const SpTypes = {

  // ── Visual Match — слоты + DnD ────────────────────────────────────────────
  async visualMatch(ex, content, container, onDone) {
    const items = content.items || [];
    if (items.length < 2) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Нужно минимум 2 пары.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button>
      </div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }

    const leftItems  = items.map((item, i) => ({ ...item, idx: i }));
    const rightItems = [...items.map((item, i) => ({ ...item, idx: i }))]
      .sort(() => Math.random() - .5);
    let attempts = 0;
    while (rightItems.some((r, i) => r.idx === i) && attempts < 20) {
      rightItems.sort(() => Math.random() - .5);
      attempts++;
    }

    const matched          = {};
    const firstAttemptFail = new Set();
    let selectedRight = null;
    const t0 = Date.now();

    async function tryMatch(leftIdx, rightIdx) {
      if (matched[leftIdx] !== undefined) return;
      if (Object.values(matched).map(Number).includes(rightIdx)) return;
      const isCorrect = leftIdx === rightIdx;
      if (isCorrect) {
        matched[leftIdx] = rightIdx;
        selectedRight = null;
        Sound.success();
        await render();
        if (Object.keys(matched).length === items.length) {
          const correctCount = items.length - firstAttemptFail.size;
          const dur = Math.round((Date.now() - t0) / 1000);
          setTimeout(() => onDone({ correct: correctCount, total: items.length, duration_sec: dur }), 500);
        }
      } else {
        firstAttemptFail.add(leftIdx);
        Sound.error();
        const slot = container.querySelector(`[data-left="${leftIdx}"]`);
        slot?.classList.add('wrong');
        const chip = container.querySelector(`[data-right="${rightIdx}"]`);
        chip?.classList.add('wrong');
        setTimeout(() => { slot?.classList.remove('wrong'); chip?.classList.remove('wrong'); }, 700);
      }
    }

    const render = async () => {
      const done  = Object.keys(matched).length;
      const total = items.length;
      const unmatchedRight = rightItems.filter(r => !Object.values(matched).map(Number).includes(r.idx));
      const IMG_H = '180px';

      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:20px 28px">
          <div style="width:100%;max-width:860px">
            <div style="font-family:var(--font-title);font-size:17px;text-align:center;margin-bottom:20px;color:var(--text-1)">
              ${done === total ? 'Всё верно!' : selectedRight !== null ? 'Выбери вопрос слева' : 'Перетащи ответ на нужный вопрос'}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
              <div style="display:flex;flex-direction:column;gap:10px">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">Вопросы</div>
                ${leftItems.map(item => {
                  const matchedRIdx = matched[item.idx];
                  const isMatched   = matchedRIdx !== undefined;
                  const hadError    = firstAttemptFail.has(item.idx);
                  const matchedR    = isMatched ? rightItems.find(r => r.idx === +matchedRIdx) : null;
                  return `
                    <div class="match-item vm-slot ${isMatched?'matched':''}" data-left="${item.idx}"
                      style="display:flex;flex-direction:column;overflow:hidden;padding:0;
                        ${!isMatched?'border:2px dashed var(--border-2);cursor:pointer':''}
                        ${hadError && isMatched?'border-color:var(--amber)!important;background:var(--amber-l,#FFFBEB)!important':''}">
                      ${item.question_img
                        ? `<div style="width:100%;height:${IMG_H};background:var(--surface-2);overflow:hidden;flex-shrink:0">
                            <img data-path="${escHtml(item.question_img)}" style="width:100%;height:100%;object-fit:contain">
                          </div>`
                        : ''}
                      ${item.question
                        ? `<div style="padding:10px 12px;font-size:15px;font-weight:600;color:var(--text-1)">${escHtml(item.question)}</div>`
                        : ''}
                      ${isMatched
                        ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
                              background:${hadError?'var(--amber-l,#FFFBEB)':'var(--green-l)'};
                              border-top:1.5px solid ${hadError?'var(--amber)':'var(--green)'}">
                            ${matchedR?.answer_img
                              ? `<img data-path="${escHtml(matchedR.answer_img)}" style="height:40px;max-width:64px;object-fit:contain;border-radius:6px;flex-shrink:0">`
                              : ''}
                            ${matchedR?.answer
                              ? `<span style="font-size:13px;font-weight:700;color:${hadError?'var(--amber-600,#92400E)':'var(--green)'}">${escHtml(matchedR.answer)}</span>`
                              : ''}
                            <span style="margin-left:auto;color:${hadError?'var(--amber)':'var(--green)'};font-size:16px">${hadError?'~':'✓'}</span>
                          </div>`
                        : `<div style="padding:10px 12px;color:var(--text-3);font-size:12px;text-align:center;
                              border-top:1px dashed var(--border-2)">перетащи ответ сюда ↓</div>`}
                    </div>`;
                }).join('')}
              </div>
              <div style="display:flex;flex-direction:column;gap:10px">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">Ответы</div>
                ${unmatchedRight.length === 0
                  ? `<div style="color:var(--text-3);font-size:13px;padding:20px 0;text-align:center">Все ответы размещены ✓</div>`
                  : unmatchedRight.map(item => `
                    <div class="match-item vm-chip ${selectedRight===item.idx?'selected':''}" data-right="${item.idx}"
                      style="display:flex;flex-direction:column;overflow:hidden;padding:0;
                        cursor:grab;touch-action:none;user-select:none">
                      ${item.answer_img
                        ? `<div style="width:100%;height:${IMG_H};background:var(--surface-2);overflow:hidden;flex-shrink:0">
                            <img data-path="${escHtml(item.answer_img)}" style="width:100%;height:100%;object-fit:contain">
                          </div>`
                        : ''}
                      ${item.answer
                        ? `<div style="padding:10px 12px;font-size:15px;font-weight:600;color:var(--text-1)">${escHtml(item.answer)}</div>`
                        : ''}
                    </div>`).join('')}
              </div>
            </div>
          </div>
        </div>`;

      await loadPlayerImages(container);
      if (done === total) return;

      container.querySelectorAll('.vm-chip[data-right]').forEach(chip => {
        const rightIdx = +chip.dataset.right;
        DnD.makeDraggable(chip, {
          data: { rightIdx },
          onDragStart: () => { selectedRight = null; },
        });
        chip.addEventListener('click', () => {
          selectedRight = selectedRight === rightIdx ? null : rightIdx;
          render();
        });
      });

      container.querySelectorAll('.vm-slot[data-left]').forEach(slot => {
        const leftIdx = +slot.dataset.left;
        if (matched[leftIdx] !== undefined) return;
        DnD.makeDropTarget(slot, {
          onDrop: ({ rightIdx }) => tryMatch(leftIdx, rightIdx),
        });
        slot.addEventListener('click', () => {
          if (selectedRight !== null) tryMatch(leftIdx, selectedRight);
        });
      });
    };

    await render();
  },

  // ── Find Pairs ──────────────────────────────────────────────────────────────
  memory_game(ex, content, container, onDone) {
    const pairs = content.pairs || [];
    if (!pairs.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Упражнение пусто.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button>
      </div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }

    const cards = [];
    pairs.forEach((p,i) => {
      cards.push({ id: cards.length, pair_id: i, text: p.a_text, img: p.a_img });
      cards.push({ id: cards.length, pair_id: i, text: p.b_text, img: p.b_img });
    });
    cards.sort(() => Math.random() - .5);

    let flipped = [], matched = new Set(), locked = false, correct = 0;
    const t0 = Date.now();

    async function render() {
      if (!container.isConnected) return;
      container.innerHTML = `
        <div class="player-body">
          <div class="player-card">
            <div style="font-family:var(--font-title);font-size:18px;text-align:center;margin-bottom:20px">Найди все пары (Мемо)</div>
            <div class="pairs-grid">
              ${cards.map(c => `
                <div class="pair-card ${matched.has(c.id)?'matched':''}" data-id="${c.id}">
                  ${matched.has(c.id)
                    ? (c.img ? `<img data-path="${escHtml(c.img)}" style="width:100%;height:100%;object-fit:contain;padding:6px;border-radius:12px">` : escHtml(c.text||'✓'))
                    : `<span style="font-size:22px;color:var(--text-3)">?</span>`}
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      container.querySelectorAll('.pair-card:not(.matched)').forEach(card => {
        card.addEventListener('click', async () => {
          if (locked || flipped.length >= 2) return;
          const cid = +card.dataset.id;
          if (flipped.includes(cid)) return;
          flipped.push(cid);
          const cd = cards.find(c => c.id === cid);
          card.classList.add('flipped');
          card.innerHTML = cd.img
            ? `<img data-path="${escHtml(cd.img)}" style="width:100%;height:100%;object-fit:contain;padding:6px;border-radius:12px">`
            : `<span style="font-size:15px;font-weight:600">${escHtml(cd.text||'')}</span>`;
          await loadPlayerImages(card.parentElement);

          if (flipped.length === 2) {
            locked = true;
            const [id1,id2] = flipped;
            const c1 = cards.find(c=>c.id===id1), c2 = cards.find(c=>c.id===id2);
            if (c1.pair_id === c2.pair_id) {
              matched.add(id1); matched.add(id2); correct++;
              flipped = []; locked = false;
              if (matched.size === cards.length) {
                onDone({ correct, total: pairs.length, duration_sec: Math.round((Date.now()-t0)/1000) });
              } else render();
            } else {
              container.querySelectorAll('.pair-card.flipped:not(.matched)').forEach(c => c.classList.add('wrong-flash'));
              setTimeout(() => { flipped=[]; locked=false; render(); }, 1000);
            }
          }
        });
      });
    }
    render();
  },

  // ── Найди пару (find_pairs) — два столбца, линии ────────────────────────────
  async findPairs(ex, content, container, onDone) {
    const pairs = content.pairs || [];
    if (!pairs.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Упражнение пусто.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button>
      </div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }

    const leftItems  = pairs.map((p, i) => ({ idx: i, text: p.a_text, img: p.a_img }));
    const rightItems = pairs.map((p, i) => ({ idx: i, text: p.b_text, img: p.b_img }))
                            .sort(() => Math.random() - .5);

    let attempts = 0;
    while (rightItems.some((r, i) => r.idx === i) && attempts < 20) {
      rightItems.sort(() => Math.random() - .5);
      attempts++;
    }

    let selectedLeft = null;
    const matched    = {};
    const errors     = {};
    const firstAttemptFail = new Set();
    const t0 = Date.now();

    const render = async () => {
      const total = pairs.length;
      const done  = Object.keys(matched).length;

      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:24px 32px">
          <div style="width:100%;max-width:860px">
            <div style="font-family:var(--font-title);font-size:18px;text-align:center;
              margin-bottom:20px;color:var(--text-1)">
              ${selectedLeft !== null ? 'Выбери пару справа' : done === total ? 'Все пары найдены!' : 'Выбери объект слева'}
            </div>
            <div style="position:relative" id="fp2-sp-arena">
              <div style="display:grid;grid-template-columns:1fr 48px 1fr;gap:0 12px">
                <div style="display:flex;flex-direction:column;gap:10px">
                  ${leftItems.map(item => {
                    const isMatched  = matched[item.idx] !== undefined;
                    const isSelected = selectedLeft === item.idx;
                    return `<div class="match-item ${isMatched ? 'matched' : isSelected ? 'selected' : ''}"
                      data-left="${item.idx}" style="min-height:70px">
                      ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:100%;max-height:110px;object-fit:contain;border-radius:8px">` : ''}
                      ${item.text ? `<div class="mi-label">${escHtml(item.text)}</div>` : ''}
                    </div>`;
                  }).join('')}
                </div>
                <div style="position:relative"></div>
                <div style="display:flex;flex-direction:column;gap:10px">
                  ${rightItems.map(item => {
                    const isMatched = Object.entries(matched).some(([l,r]) => +r === item.idx);
                    const isError   = errors[item.idx];
                    return `<div class="match-item ${isMatched ? 'matched' : ''} ${isError ? 'wrong' : ''}"
                      data-right="${item.idx}" style="min-height:70px">
                      ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:100%;max-height:110px;object-fit:contain;border-radius:8px">` : ''}
                      ${item.text ? `<div class="mi-label">${escHtml(item.text)}</div>` : ''}
                    </div>`;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>`;

      await loadPlayerImages(container);
      _drawMatchLines(container, leftItems, rightItems, matched, '#fp2-sp-arena');

      if (done === total) {
        const correctCount = total - firstAttemptFail.size;
        onDone({ correct: correctCount, total, duration_sec: Math.round((Date.now()-t0)/1000) });
        return;
      }

      container.querySelectorAll('[data-left]').forEach(card => {
        card.addEventListener('click', () => {
          const idx = +card.dataset.left;
          if (matched[idx] !== undefined) return;
          selectedLeft = selectedLeft === idx ? null : idx;
          render();
        });
      });

      container.querySelectorAll('[data-right]').forEach(card => {
        card.addEventListener('click', async () => {
          if (selectedLeft === null) return;
          const rightIdx = +card.dataset.right;
          if (Object.values(matched).map(Number).includes(rightIdx)) return;
          const isCorrect = rightIdx === selectedLeft;
          if (isCorrect) {
            matched[selectedLeft] = rightIdx;
            Sound.success();
            selectedLeft = null;
            render();
          } else {
            firstAttemptFail.add(selectedLeft);
            Sound.error();
            errors[rightIdx] = true;
            await render();
            setTimeout(() => { delete errors[rightIdx]; render(); }, 700);
          }
        });
      });
    };

    await render();
  },

  // ── Odd One Out ─────────────────────────────────────────────────────────────
  oddOneOut(ex, content, container, onDone) {
    const tasks = content.tasks || [];
    if (!tasks.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Упражнение пусто.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button>
      </div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }

    const shuffled = [...tasks].sort(() => Math.random() - .5);
    let idx = 0, correct = 0;
    const t0 = Date.now();

    async function render() {
      if (!container.isConnected) return;
      if (idx >= shuffled.length) {
        onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now()-t0)/1000) });
        return;
      }
      const task = shuffled[idx];
      const odd  = task.items[task.odd_index ?? 0];
      const items = [...task.items].sort(() => Math.random() - .5);

      container.innerHTML = `
        <div class="player-body">
          <div class="player-card">
            <div class="player-question">Найди лишний предмет</div>
            <div class="player-options cols-2">
              ${items.map(it => {
                const isOdd = it.text===odd?.text && it.img===odd?.img;
                return `<div class="player-opt" data-odd="${isOdd}">
                  ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:90px;height:90px;object-fit:contain;padding:4px;border-radius:10px">` : ''}
                  ${it.text ? `<span>${escHtml(it.text)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;

      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;
      container.querySelectorAll('.player-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          const ok = opt.dataset.odd === 'true';
          if(ok) Sound.success(); else Sound.error();
          opt.classList.add(ok ? 'correct' : 'wrong');
          if (!ok) container.querySelectorAll('.player-opt').forEach(o => { if (o.dataset.odd==='true') o.classList.add('correct'); });
          else correct++;
          container.querySelectorAll('.player-opt').forEach(o => o.classList.add('disabled'));
          setTimeout(() => { idx++; render(); }, 900);
        });
      });
    }
    render();
  },

  // ── Sorting ─────────────────────────────────────────────────────────────────
  async sorting(ex, content, container, onDone) {
    // Нормализуем категории: строки → объекты {name, img}
    const rawCats = content.categories || [];
    const cats = rawCats.map(c => typeof c === 'string' ? { name: c, img: '' } : c);
    const items = content.items || [];

    if (!cats.length || !items.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Упражнение пусто.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button>
      </div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }

    const shuffled = [...items].sort(() => Math.random() - .5);
    const placed   = {};
    cats.forEach(c => { placed[c.name] = []; });
    const wrongOnce = new Set();
    const t0 = Date.now();

    const render = async () => {
      const totalPlaced = Object.values(placed).reduce((s, a) => s + a.length, 0);
      const isDone = totalPlaced === shuffled.length;

      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:24px 32px">
          <div style="width:100%;max-width:860px">
            <div style="font-family:var(--font-title);font-size:18px;text-align:center;margin-bottom:20px">
              Разложи по корзинам
            </div>
            <!-- Пул -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;min-height:60px;
              padding:12px;background:var(--surface-2);border-radius:var(--r-xl);
              border:2px dashed var(--border-2);margin-bottom:20px" id="sp-sort-pool">
              ${shuffled.filter(it => !Object.values(placed).flat().includes(it)).map((it, i) => `
                <div class="sort-chip-v2" data-pool-i="${i}">
                  ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:100px;height:100px;object-fit:contain;border-radius:var(--r-sm)">` : ''}
                  ${it.text ? `<div class="sc-label">${escHtml(it.text)}</div>` : ''}
                </div>`).join('')
              || '<div style="color:var(--text-3);font-size:13px;margin:auto">Все распределены ✓</div>'}
            </div>
            <!-- Корзины -->
            <div style="display:grid;grid-template-columns:repeat(${Math.min(cats.length,3)},1fr);gap:12px">
              ${cats.map((cat, ci) => `
                <div class="sort-bucket-v2 bucket-${ci % 6}" data-bucket="${escHtml(cat.name)}">
                  <div class="sb-header">
                    ${cat.img ? `<img data-path="${escHtml(cat.img)}" class="sb-img">` : ''}
                    <div class="sb-title">${escHtml(cat.name)}</div>
                  </div>
                  <div class="sb-items">
                    ${(placed[cat.name]||[]).length === 0
                      ? `<div class="sb-hint">↓ перетащи сюда</div>`
                      : (placed[cat.name]||[]).map(it => `
                      <div class="sort-chip-v2 placed-chip" data-placed-cat="${escHtml(cat.name)}" style="cursor:pointer">
                        ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:76px;height:76px;object-fit:contain;border-radius:var(--r-sm)">` : ''}
                        ${it.text ? `<div class="sc-label">${escHtml(it.text)}</div>` : ''}
                      </div>`).join('')}
                  </div>
                </div>`).join('')}
            </div>
            ${isDone ? `
              <div style="text-align:center;margin-top:20px">
                <button class="btn btn-primary" id="sp-sort-done" style="padding:14px 40px;font-size:16px">
                  Готово ✓
                </button>
              </div>` : ''}
          </div>
        </div>`;

      await loadPlayerImages(container);

      let selected = null;
      const poolItems = shuffled.filter(it => !Object.values(placed).flat().includes(it));

      container.querySelectorAll('.sort-chip-v2[data-pool-i]').forEach((chip, ci) => {
        const item = poolItems[ci];
        chip.addEventListener('click', () => {
          if (selected?.item === item) { selected = null; chip.classList.remove('selected'); render(); return; }
          container.querySelectorAll('.sort-chip-v2').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          selected = { item };
        });
        DnD.makeDraggable(chip, { data: { item } });
      });

      container.querySelectorAll('.placed-chip').forEach(chip => {
        chip.addEventListener('click', e => {
          e.stopPropagation();
          const catName = chip.dataset.placedCat;
          const imgPath = chip.querySelector('img')?.dataset?.path || '';
          const text    = chip.querySelector('.sc-label')?.textContent || '';
          const idx = placed[catName].findIndex(it =>
            (it.img === imgPath || (!it.img && !imgPath)) &&
            (it.text === text   || (!it.text && !text))
          );
          if (idx !== -1) { placed[catName].splice(idx, 1); render(); }
        });
      });

      container.querySelectorAll('.sort-bucket-v2').forEach(bucket => {
        const catName = bucket.dataset.bucket;
        DnD.makeDropTarget(bucket, {
          onDrop: (data) => {
            placed[catName].push(data.item);
            if (data.item.category !== catName) wrongOnce.add(data.item);
            DnD.cleanup(container);
            render();
          },
        });
        bucket.addEventListener('click', () => {
          if (!selected) return;
          placed[catName].push(selected.item);
          if (selected.item.category !== catName) wrongOnce.add(selected.item);
          selected = null;
          render();
        });
      });

      container.querySelector('#sp-sort-done')?.addEventListener('click', () => {
        const correct = shuffled.filter(it => !wrongOnce.has(it) && it.category === Object.keys(placed).find(k => placed[k].includes(it))).length;
        onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now()-t0)/1000) });
      });
    };
    await render();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  SpRunner — маршрутизатор упражнений для режима цепочки
//  Вызывает нужный метод SpTypes, возвращает true если тип поддерживается
// ══════════════════════════════════════════════════════════════════════════════
const SpRunner = {
  run(ex, content, container, onDone, onClose) {
    // Нормализация полей (редактор сохраняет image/text, SpTypes ждёт img/label)
    const norm = (items) => (items||[]).map(it => ({
      ...it,
      img:      it.img      || it.image    || '',
      label:    it.label    || it.text     || '',
      a_img:    it.a_img    || it.a_image  || '',
      b_img:    it.b_img    || it.b_image  || '',
    }));

    const c = { ...content };

    const routes = {
      visual_match:  () => SpTypes.visualMatch(ex, { ...c, items: norm(c.pairs||c.items||[]) }, container, onDone),
      find_pairs:    () => SpTypes.findPairs(ex, { ...c, pairs: (c.pairs||[]) }, container, onDone),
      memory_game:   () => SpTypes.memory_game(ex, { ...c, pairs: (c.cards||c.pairs||[]).map((p,i)=>({...p,a_text:p.text||p.a_text||'',b_text:p.text||p.b_text||'',a_img:p.image||p.img||p.a_img||'',b_img:p.image||p.img||p.b_img||'',pairId:i})) }, container, onDone),
      odd_one_out:   () => SpTypes.oddOneOut(ex, { ...c, tasks: (c.tasks||[]).map(t=>({...t,items:(t.items||[]).map(it=>({...it,img:it.img||it.image||''}))}) ) }, container, onDone),
      sorting:       () => SpTypes.sorting(ex, {
          categories: (c.categories||[]).map(cat=>cat.name||cat),
          items: norm(c.items||[]).map(it=>({ ...it, category: c.categories?.[it.category]?.name || c.categories?.[it.category] || it.category })),
        }, container, onDone),
      categories:    () => SpTypes.categories(ex, c, container, onDone),
      sequencing:    () => SpTypes.sequencing(ex, { ...c, items: norm(c.items||[]) }, container, onDone),
      whats_missing: () => SpTypes.whatsMissing(ex, { ...c, items: norm(c.items||[]) }, container, onDone),
      pattern:       () => SpTypes.pattern(ex, c, container, onDone),
      word_to_pic:   () => SpTypes.wordToPic(ex, c, container, onDone),
      word_builder:  () => SpTypes.wordBuilder(ex, c, container, onDone),
      fill_blank:    () => SpTypes.fillBlank(ex, c, container, onDone),
      first_sound:   () => SpTypes.firstSound(ex, c, container, onDone),
      counting:      () => SpTypes.counting(ex, c, container, onDone),
      size_order:    () => SpTypes.sizeOrder(ex, { ...c, items: norm(c.items||[]) }, container, onDone),
      compare:       () => SpTypes.compare(ex, c, container, onDone),
      true_false:    () => SpTypes.trueFalse(ex, c, container, onDone),
      syllables:     () => SpTypes.syllables(ex, c, container, onDone),
      sound_position:() => SpTypes.soundPosition(ex, c, container, onDone),
      syllable_count:() => SpTypes.syllableCount(ex, c, container, onDone),
      label_image:   () => SpTypes.labelImage(ex, c, container, onDone),
      yes_no:        () => SpTypes.yesNo(ex, c, container, onDone),
    };
    const fn = routes[ex.type];
    if (fn) { fn(); return true; }
    return false;
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  ДОПОЛНИТЕЛЬНЫЕ ТИПЫ ДЛЯ ЦЕПОЧЕК
// ══════════════════════════════════════════════════════════════════════════════
Object.assign(SpTypes, {

  // ── Три группы (categories) ────────────────────────────────────────────────
  categories(ex, content, container, onDone) {
    const groups = content.groups || content.categories || [];
    const rawItems = content.items || [];
    if (!groups.length || !rawItems.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Упражнение пусто.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button></div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }
    // Delegate to sorting with normalized data
    const cats = groups.map(g => g.name || String(g));
    const items = rawItems.map(it => ({
      ...it,
      img:      it.img || it.image || '',
      label:    it.label || it.text || '',
      category: cats[it.group ?? it.category ?? 0] || cats[0],
    }));
    SpTypes.sorting(ex, { categories: cats, items }, container, onDone);
  },

  // ── Последовательность ────────────────────────────────────────────────────
  sequencing(ex, content, container, onDone) {
    const items = content.items || [];
    if (items.length < 2) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нужно минимум 2 элемента</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }
    let order = [...Array(items.length).keys()].sort(() => Math.random() - .5);
    let selected = [];
    const t0 = Date.now();

    async function render() {
      if (!container.isConnected) return;
      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto">
          <div class="player-card" style="max-width:840px;width:100%">
            <div class="player-question" style="margin-bottom:20px">Расставь по порядку</div>
            <div id="sp-seq-zone" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;min-height:90px;
              background:var(--surface-2);border:2px dashed var(--border);border-radius:var(--r-lg);padding:10px;margin-bottom:16px">
              ${selected.map((origIdx,pos) => {
                const item = items[origIdx];
                return `<div class="seq-placed-slot slot-${pos % 6} seq-placed" data-pos="${pos}" data-orig="${origIdx}">
                  <div class="sl-num">${pos+1}</div>
                  ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:96px;height:96px;object-fit:contain;border-radius:8px;background:var(--surface)">` : ''}
                  ${item.label ? `<div class="sl-label">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('') || '<div style="color:var(--text-3);font-size:13px;margin:auto">Перетащи или нажимай элементы</div>'}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:20px">
              ${order.map((origIdx) => {
                const item = items[origIdx];
                const placed = selected.includes(origIdx);
                return `<div class="${placed?'':'seq-opt'}" data-orig="${origIdx}" style="display:flex;flex-direction:column;align-items:center;gap:4px;
                  cursor:${placed?'default':'grab'};opacity:${placed?.2:1};padding:8px;border-radius:var(--r-lg);
                  border:2px solid var(--border);background:var(--surface);min-width:70px;text-align:center;touch-action:none">
                  ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:96px;height:96px;object-fit:contain;border-radius:8px">` : ''}
                  ${item.label ? `<div style="font-size:11px;color:var(--text-2)">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            <div style="text-align:center;display:flex;gap:10px;justify-content:center">
              ${selected.length > 0 ? `<button class="btn btn-ghost" id="seq-undo">↩ Убрать</button>` : ''}
              ${selected.length === items.length ? `<button class="btn btn-primary" id="seq-check">Проверить →</button>` : ''}
            </div>
          </div>
        </div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      container.querySelectorAll('.seq-opt').forEach(opt => opt.addEventListener('click', () => { selected.push(+opt.dataset.orig); render(); }));
      container.querySelectorAll('.seq-placed').forEach(p => p.addEventListener('click', () => { selected.splice(+p.dataset.pos,1); render(); }));
      container.querySelector('#seq-undo')?.addEventListener('click', () => { selected.pop(); render(); });
      container.querySelector('#seq-check')?.addEventListener('click', () => {
        const correct = selected.filter((origIdx,pos) => origIdx===pos).length;
        onDone({ correct, total: items.length, duration_sec: Math.round((Date.now()-t0)/1000) });
      });

      // DnD: тащить из пула в зону
      container.querySelectorAll('.seq-opt[data-orig]').forEach(chip => {
        DnD.makeDraggable(chip, { data: { origIdx: +chip.dataset.orig } });
      });
      const zone = container.querySelector('#sp-seq-zone');
      if (zone) {
        DnD.makeDropTarget(zone, {
          onDrop: ({ origIdx }) => {
            if (!selected.includes(origIdx)) { selected.push(origIdx); DnD.cleanup(container); render(); }
          },
        });
      }
      // DnD: переставить размещённые
      container.querySelectorAll('.seq-placed[data-pos]').forEach(placed => {
        const pos = +placed.dataset.pos;
        DnD.makeDraggable(placed, { data: { placedPos: pos } });
        DnD.makeDropTarget(placed, {
          onDrop: ({ placedPos: fp }) => {
            if (fp === undefined || fp === pos) return;
            [selected[fp], selected[pos]] = [selected[pos], selected[fp]];
            DnD.cleanup(container); render();
          },
        });
      });
    }
    render();
  },

  // ── По размеру ────────────────────────────────────────────────────────────
  sizeOrder(ex, content, container, onDone) {
    const items = content.items || [];
    const dir   = content.direction || 'asc';
    if (items.length < 2) {
      container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нужно минимум 2 предмета</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({correct:0,total:0,duration_sec:0}));
      return;
    }
    const shuffled = [...items].sort(() => Math.random()-.5);
    let   order    = [...Array(shuffled.length).keys()];
    let   selPos   = null;
    const t0       = Date.now();

    async function render() {
      if (!container.isConnected) return;
      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto">
          <div class="player-card" style="max-width:840px;width:100%">
            <div class="player-question" style="margin-bottom:20px">${dir==='asc'?'От меньшего к большему →':'← От большего к меньшему'}</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;align-items:flex-end">
              ${order.map((si,pos) => {
                const item = shuffled[si];
                const isSel = selPos===pos;
                return `<div class="so-item" data-pos="${pos}" style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:grab;
                  padding:10px;border-radius:var(--r-xl);border:2px solid ${isSel?'var(--indigo)':'var(--border)'};
                  background:${isSel?'var(--indigo-l)':'var(--surface)'};min-width:78px;text-align:center;
                  touch-action:none;user-select:none;transition:border-color .15s">
                  <div style="font-size:10px;font-weight:700;color:${isSel?'var(--indigo)':'var(--text-3)'}">${pos+1}</div>
                  ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:106px;height:106px;object-fit:contain;border-radius:8px">` : ''}
                  ${item.label ? `<div style="font-size:11px;color:var(--text-2)">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            <div style="text-align:center;font-size:12px;color:var(--text-3);margin-bottom:12px">
              Перетащи или нажми два элемента, чтобы поменять местами
            </div>
            <div style="text-align:center"><button class="btn btn-primary" id="so-check">Проверить →</button></div>
          </div>
        </div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      // Тап: выбрать первый → второй → swap
      container.querySelectorAll('.so-item').forEach(el => {
        el.addEventListener('click', () => {
          const pos = +el.dataset.pos;
          if (selPos===null) { selPos=pos; render(); }
          else if (selPos===pos) { selPos=null; render(); }
          else { [order[selPos],order[pos]]=[order[pos],order[selPos]]; selPos=null; render(); }
        });
      });

      // DnD: тащить одну карточку на другую → swap
      container.querySelectorAll('.so-item[data-pos]').forEach(card => {
        const fromPos = +card.dataset.pos;
        DnD.makeDraggable(card, {
          data: { fromPos },
          onDragStart: () => { selPos = null; },
        });
        DnD.makeDropTarget(card, {
          onDrop: ({ fromPos: fp }) => {
            if (fp === undefined || fp === fromPos) return;
            [order[fp], order[fromPos]] = [order[fromPos], order[fp]];
            DnD.cleanup(container); render();
          },
        });
      });

      container.querySelector('#so-check').addEventListener('click', () => {
        // Правильный порядок — items[0] наименьший, items[n-1] наибольший
        const correctOrder = dir==='asc' ? items : [...items].reverse();
        const correct = order.filter((si,pos) => shuffled[si].label===correctOrder[pos]?.label || shuffled[si].img===correctOrder[pos]?.img).length;
        onDone({ correct, total:items.length, duration_sec:Math.round((Date.now()-t0)/1000) });
      });
    }
    render();
  },

  // ── Что исчезло? ──────────────────────────────────────────────────────────
  whatsMissing(ex, content, container, onDone) {
    const items = content.items || [];
    if (items.length < 2) {
      container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нужно минимум 2 предмета</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({correct:0,total:0,duration_sec:0}));
      return;
    }
    let round=0, correct=0;
    const ROUNDS=Math.min(items.length,5), t0=Date.now();

    async function nextRound() {
      if (round>=ROUNDS) { onDone({correct,total:ROUNDS,duration_sec:Math.round((Date.now()-t0)/1000)}); return; }
      const missingIdx=Math.floor(Math.random()*items.length);
      const shown=items.filter((_,i)=>i!==missingIdx);

      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:720px;width:100%">
        <div class="player-question" style="margin-bottom:16px">Запомни предметы!</div>
        <div id="wm-cd" style="font-size:44px;font-weight:800;text-align:center;color:var(--indigo);margin-bottom:12px">3</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">${shown.map(it=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:12px;text-align:center;min-width:80px">
          ${it.img?`<img data-path="${escHtml(it.img)}" style="height:80px;object-fit:contain;border-radius:6px">`:''}
          ${it.label?`<div style="font-size:12px;margin-top:4px">${escHtml(it.label)}</div>`:''}
        </div>`).join('')}</div></div></div>`;
      await loadPlayerImages(container);

      await new Promise(res => {
        let t=3; Sound.start();
        const iv=setInterval(()=>{ t--; Sound.timerTick(); if(t<=0){clearInterval(iv);res();} else { const el=container.querySelector('#wm-cd'); if(el) el.textContent=t; } },1000);
      });

      const opts=[...Array(items.length).keys()].sort(()=>Math.random()-.5);
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:720px;width:100%">
        <div class="player-question" style="margin-bottom:20px">Что исчезло?</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
          ${opts.map(i=>`<button class="player-opt wm-opt" data-i="${i}" style="padding:10px 16px;font-size:14px">${escHtml(items[i].label||String(i+1))}</button>`).join('')}
        </div></div></div>`;
      container.querySelectorAll('.wm-opt').forEach(btn=>btn.addEventListener('click',()=>{
        const ok=+btn.dataset.i===missingIdx;
        if(ok) correct++;
        container.querySelectorAll('.wm-opt').forEach(b=>{b.disabled=true; if(+b.dataset.i===missingIdx){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}
        round++; setTimeout(nextRound,900);
      }));
    }
    nextRound();
  },

  // ── Продолжи ряд ──────────────────────────────────────────────────────────
  async pattern(ex, content, container, onDone) {
    const seqs  = content.sequences || [];
    const isImg = content.mode === 'image';
    if (!seqs.length) {
      container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет рядов</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({correct:0,total:0,duration_sec:0}));
      return;
    }
    let idx=0, correct=0; const t0=Date.now();
    const next = async () => {
      if (idx>=seqs.length) { onDone({correct,total:seqs.length,duration_sec:Math.round((Date.now()-t0)/1000)}); return; }
      const seq=seqs[idx];

      if (!isImg) {
        // ── Текстовый режим ─────────────────────────────────────────────────
        const opts=[...(seq.options||[])].map((v,i)=>({v,i})).sort(()=>Math.random()-.5);
        container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:720px;width:100%">
          <div class="player-question" style="margin-bottom:20px">Что идёт дальше? (${idx+1}/${seqs.length})</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:24px">
            ${(seq.items||[]).map(v=>`<div style="width:54px;height:80px;border-radius:var(--r-md);background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:22px">${escHtml(String(v))}</div>`).join('')}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
            ${opts.map(opt=>`<button class="player-opt pat-opt" data-i="${opt.i}" style="width:82px;height:82px;font-size:26px;font-weight:800;padding:0;display:flex;align-items:center;justify-content:center">${escHtml(String(opt.v))}</button>`).join('')}
          </div></div></div>`;
        container.querySelectorAll('.pat-opt').forEach(btn=>btn.addEventListener('click',()=>{
          const ok=+btn.dataset.i===seq.answer;
          if(ok){Sound.success();correct++;}else Sound.error();
          container.querySelectorAll('.pat-opt').forEach(b=>{b.disabled=true; if(+b.dataset.i===seq.answer){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
          if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}
          idx++; setTimeout(next,1000);
        }));

      } else {
        // ── Режим картинок ──────────────────────────────────────────────────
        const items    = seq.items   || [];
        const gapIdx   = seq.gap_index ?? items.length - 1;
        const options  = seq.options  || [];
        const shuffled = [...options.map((op,i)=>({op,i}))].sort(()=>Math.random()-.5);

        container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:720px;width:100%">
          <div class="player-question" style="margin-bottom:20px">Что на месте знака вопроса? (${idx+1}/${seqs.length})</div>
          <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:24px" id="pat-sp-row"></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center" id="pat-sp-opts"></div>
        </div></div>`;

        const rowWrap  = container.querySelector('#pat-sp-row');
        const optsWrap = container.querySelector('#pat-sp-opts');

        for (let ii=0; ii<items.length; ii++) {
          const cell=document.createElement('div');
          cell.style.cssText='width:72px;height:72px;border-radius:var(--r-md);background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden;flex-shrink:0';
          if (ii===gapIdx) {
            cell.style.borderStyle='dashed'; cell.style.background='var(--surface-2)';
            cell.innerHTML='<span style="font-size:28px;color:var(--text-3)">?</span>';
          } else {
            const it=items[ii];
            if (it&&it.img) { const d=await window.db.files.getImageData(it.img); if(d) cell.innerHTML=`<img src="${d}" style="width:100%;height:100%;object-fit:contain">`; }
            if (it&&it.label) { const lbl=document.createElement('div'); lbl.style.cssText='font-size:10px;color:var(--text-2);text-align:center'; lbl.textContent=it.label; cell.appendChild(lbl); }
          }
          rowWrap.appendChild(cell);
        }

        for (const {op,i} of shuffled) {
          const btn=document.createElement('button'); btn.className='player-opt pat-sp-opt'; btn.dataset.i=i;
          btn.style.cssText='width:86px;height:86px;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px';
          if (op.img) { const d=await window.db.files.getImageData(op.img); if(d){const img=document.createElement('img');img.src=d;img.style.cssText='width:100%;height:66px;object-fit:contain;border-radius:var(--r-sm)';btn.appendChild(img);} }
          if (op.label) { const lbl=document.createElement('div'); lbl.style.cssText='font-size:10px;color:var(--text-2)'; lbl.textContent=op.label; btn.appendChild(lbl); }
          btn.addEventListener('click',()=>{
            const ok=i===seq.answer;
            if(ok){Sound.success();correct++;}else Sound.error();
            container.querySelectorAll('.pat-sp-opt').forEach(b=>{b.disabled=true;if(+b.dataset.i===seq.answer){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
            if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}
            idx++; setTimeout(next,1000);
          });
          optsWrap.appendChild(btn);
        }
      }
    };
    await next();
  },

  // ── Слово → картинка ──────────────────────────────────────────────────────
  wordToPic(ex, content, container, onDone) {
    const tasks=content.items||[]; if(!tasks.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    async function next(){if(idx>=tasks.length){onDone({correct,total:tasks.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const task=tasks[idx];const pics=[...(task.pics||[]).map((p,i)=>({...p,origIdx:i}))].sort(()=>Math.random()-.5);
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:840px;width:100%">
        <div style="font-size:44px;font-weight:800;text-align:center;margin-bottom:24px;letter-spacing:.05em">${escHtml(task.word||'')}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px" id="wtp-g"></div></div></div>`;
      const grid=container.querySelector('#wtp-g');
      for(const pic of pics){const btn=document.createElement('button');btn.className='player-opt';btn.style.cssText='padding:12px;aspect-ratio:1;display:flex;align-items:center;justify-content:center';
        const imgP=pic.image||pic.img||'';if(imgP){const d=await window.db.files.getImageData(imgP);if(d)btn.innerHTML=`<img src="${d}" style="width:100%;height:100%;object-fit:contain;border-radius:var(--r-md)">`;}
        if(!btn.innerHTML)btn.textContent='?';
        btn.addEventListener('click',()=>{const ok=pic.correct;if(ok){Sound.success();correct++;}else Sound.error();
          container.querySelectorAll('.player-opt').forEach(b=>{b.disabled=true;if(b===btn&&ok){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}else if(b===btn&&!ok){b.style.background='var(--rose-l)';b.style.borderColor='var(--rose)';}});
          idx++;setTimeout(next,900);});grid.appendChild(btn);}
    }next();
  },

  // ── Составь слово ─────────────────────────────────────────────────────────
  wordBuilder(ex, content, container, onDone) {
    const words = content.words || [];
    if (!words.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет слов</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }
    let idx = 0, correct = 0;
    const t0 = Date.now();

    function nextWord() {
      if (idx >= words.length) {
        onDone({ correct, total: words.length, duration_sec: Math.round((Date.now()-t0)/1000) });
        return;
      }
      const wordObj = words[idx];
      const letters = (wordObj.text || wordObj.word || '').toUpperCase().split('');
      if (!letters.length) { idx++; nextWord(); return; }

      const shuffled = [...letters];
      for (let i = shuffled.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const pool  = shuffled.map((l, i) => ({ letter: l, id: i }));
      let slots = Array(letters.length).fill(null);

      function render() {
        const allFilled = slots.every(s => s !== null);
        container.innerHTML = `
          <div class="player-body" style="overflow-y:auto">
            <div class="player-card" style="max-width:680px;width:100%;text-align:center">
              <div class="player-question" style="margin-bottom:12px">Составь слово (${idx+1}/${words.length})</div>
              ${(wordObj.img || wordObj.hint) ? `
                <div style="margin-bottom:16px">
                  ${wordObj.img ? `<div id="sp-wb-img" style="margin-bottom:8px"></div>` : ''}
                  ${wordObj.hint ? `<div style="font-size:13px;color:var(--text-3)">${escHtml(wordObj.hint)}</div>` : ''}
                </div>` : ''}

              <!-- Позиционные слоты -->
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;
                min-height:76px;margin-bottom:20px;align-items:center">
                ${slots.map((s, pos) => s
                  ? `<div class="wb-slot wb-slot-filled" data-pos="${pos}"
                      style="width:62px;height:62px;border-radius:var(--r-lg);
                        background:var(--indigo);color:#fff;font-size:24px;font-weight:700;
                        display:flex;align-items:center;justify-content:center;
                        cursor:pointer;touch-action:none;user-select:none">${s.letter}</div>`
                  : `<div class="wb-slot wb-slot-empty" data-pos="${pos}"
                      style="width:62px;height:62px;border-radius:var(--r-lg);
                        background:var(--surface-2);border:2px dashed var(--border-2);
                        display:flex;align-items:center;justify-content:center;
                        font-size:13px;font-weight:700;color:var(--text-3)">${pos+1}</div>`
                ).join('')}
              </div>

              <!-- Пул -->
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">
                ${pool.map(p => {
                  const isUsed = slots.some(s => s?.id === p.id);
                  return `<div class="wb-pool-letter ${isUsed ? '' : 'wb-pick'}" data-id="${p.id}"
                    style="width:62px;height:62px;border-radius:var(--r-lg);
                      background:${isUsed?'var(--surface-2)':'var(--surface)'};
                      color:${isUsed?'var(--text-3)':'var(--text-1)'};
                      border:2px solid ${isUsed?'var(--border)':'var(--border-2)'};
                      font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center;
                      cursor:${isUsed?'default':'grab'};opacity:${isUsed?.35:1};
                      touch-action:none;user-select:none;transition:all .15s">${p.letter}</div>`;
                }).join('')}
              </div>

              <div style="display:flex;gap:8px;justify-content:center">
                ${slots.some(s=>s!==null) ? `<button class="btn btn-ghost" id="sp-wb-clear">Очистить</button>` : ''}
                ${allFilled ? `<button class="btn btn-primary" id="sp-wb-check">Проверить →</button>` : ''}
              </div>
            </div>
          </div>`;

        if (wordObj.img) {
          window.db.files.getImageData(wordObj.img).then(d => {
            const el = container.querySelector('#sp-wb-img');
            if (el && d) el.innerHTML = `<img src="${d}" style="max-height:140px;object-fit:contain;border-radius:var(--r-lg)">`;
          }).catch(()=>{});
        }

        // Тап из пула → первый пустой слот
        container.querySelectorAll('.wb-pick').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = pool.find(p => p.id === +btn.dataset.id);
            if (!p || slots.some(s => s?.id === p.id)) return;
            const emptyPos = slots.findIndex(s => s === null);
            if (emptyPos !== -1) { slots[emptyPos] = { letter: p.letter, id: p.id }; render(); }
          });
          DnD.makeDraggable(btn, { data: { poolId: +btn.dataset.id } });
        });

        // Тап по слоту → убрать
        container.querySelectorAll('.wb-slot-filled').forEach(slot => {
          slot.addEventListener('click', () => { slots[+slot.dataset.pos] = null; render(); });
          DnD.makeDraggable(slot, { data: { fromPos: +slot.dataset.pos } });
        });

        // Drop targets: все слоты
        container.querySelectorAll('.wb-slot').forEach(slot => {
          const toPos = +slot.dataset.pos;
          DnD.makeDropTarget(slot, {
            onDrop: (data) => {
              if (data.poolId !== undefined) {
                const p = pool.find(p => p.id === data.poolId);
                if (!p || slots.some(s => s?.id === p.id) || slots[toPos] !== null) return;
                slots[toPos] = { letter: p.letter, id: p.id };
              } else if (data.fromPos !== undefined) {
                const fromPos = data.fromPos;
                if (fromPos === toPos) return;
                [slots[fromPos], slots[toPos]] = [slots[toPos], slots[fromPos]];
              }
              DnD.cleanup(container);
              render();
            },
          });
        });

        container.querySelector('#sp-wb-clear')?.addEventListener('click', () => { slots = Array(letters.length).fill(null); render(); });
        container.querySelector('#sp-wb-check')?.addEventListener('click', () => {
          const assembled = slots.map(s => s?.letter || '').join('');
          const ok = assembled === letters.join('');
          if (ok) { Sound.win(); correct++; } else Sound.error();
          container.querySelectorAll('.wb-slot-filled').forEach(s => {
            s.style.background = ok ? 'var(--green)' : 'var(--rose)';
          });
          idx++;
          setTimeout(nextWord, ok ? 700 : 1400);
        });
      }
      render();
    }
    nextWord();
  },

  // ── Вставь слово ──────────────────────────────────────────────────────────
  fillBlank(ex, content, container, onDone) {
    const sents=content.sentences||[];if(!sents.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет предложений</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    function next(){if(idx>=sents.length){onDone({correct,total:sents.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const s=sents[idx];const opts=[s.correct,...(s.options||[]).filter(Boolean)].sort(()=>Math.random()-.5);
      const parts=(s.text||'').split('___');
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:660px;width:100%">
        <div class="player-question" style="margin-bottom:20px">Вставь подходящее слово (${idx+1}/${sents.length})</div>
        <div style="font-size:22px;font-weight:500;text-align:center;line-height:1.8;margin-bottom:24px">
          ${escHtml(parts[0])}<span id="fb-blank" style="display:inline-block;min-width:80px;border-bottom:3px solid var(--indigo);margin:0 6px;text-align:center;font-weight:700;color:var(--indigo)"> ? </span>${escHtml(parts[1]||'')}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${opts.map(opt=>`<button class="player-opt fb-opt" data-v="${escHtml(opt)}" style="font-size:19px;padding:14px 28px;font-weight:600">${escHtml(opt)}</button>`).join('')}
        </div></div></div>`;
      container.querySelectorAll('.fb-opt').forEach(btn=>btn.addEventListener('click',()=>{const ok=btn.dataset.v===s.correct;if(ok){Sound.success();correct++;}else Sound.error();
        container.querySelector('#fb-blank').textContent=btn.dataset.v;container.querySelector('#fb-blank').style.color=ok?'var(--green)':'var(--rose)';
        container.querySelectorAll('.fb-opt').forEach(b=>{b.disabled=true;if(b.dataset.v===s.correct){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}idx++;setTimeout(next,1000);}));
    }next();
  },

  // ── Первый звук ───────────────────────────────────────────────────────────
  firstSound(ex, content, container, onDone) {
    const items=content.items||[];if(!items.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    async function next(){if(idx>=items.length){onDone({correct,total:items.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const item=items[idx];const letters=[...(item.letters||[])].sort(()=>Math.random()-.5);
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:620px;width:100%">
        <div class="player-question" style="margin-bottom:20px">Первый звук (${idx+1}/${items.length})</div>
        <div style="text-align:center;margin-bottom:24px">
          ${item.img?`<div id="fs-img" style="margin-bottom:12px"></div>`:''}
          <div style="font-size:26px;font-weight:700">${escHtml(item.label||item.word||'')}</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          ${letters.map((lt,i)=>`<button class="player-opt fs-opt" data-i="${i}" style="width:96px;height:96px;font-size:34px;font-weight:800;text-transform:uppercase;padding:0">${escHtml(lt.letter||'')}</button>`).join('')}
        </div></div></div>`;
      if(item.img){const d=await window.db.files.getImageData(item.img||item.image||'');if(d){const el=container.querySelector('#fs-img');if(el)el.innerHTML=`<img src="${d}" style="height:150px;object-fit:contain;border-radius:var(--r-md)">`;}}
      container.querySelectorAll('.fs-opt').forEach((btn,bi)=>btn.addEventListener('click',()=>{const ok=letters[bi].correct;if(ok){Sound.success();correct++;}else Sound.error();
        container.querySelectorAll('.fs-opt').forEach(b=>{b.disabled=true;const lt=letters[+b.dataset.i];if(lt.correct){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}idx++;setTimeout(next,1000);}));
    }next();
  },

  // ── Считаем ───────────────────────────────────────────────────────────────
  counting(ex, content, container, onDone) {
    const tasks=(content.tasks||[]).map(t=>({...t, correct: t.correct ?? t.answer ?? 0}));
    if(!tasks.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    async function next(){if(idx>=tasks.length){onDone({correct,total:tasks.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const task=tasks[idx];
      // Generate opts from minOpt/maxOpt (editor format) or options array
      let opts;
      if(task.options&&task.options.length){opts=[...task.options].sort(()=>Math.random()-.5);}
      else{const minO=task.minOpt??0,maxO=task.maxOpt??5;opts=[];for(let n=minO;n<=maxO;n++)opts.push(n);if(!opts.includes(task.correct))opts.push(task.correct);opts.sort((a,b)=>a-b);}
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:660px;width:100%">
        <div class="player-question" style="margin-bottom:16px">Сколько? (${idx+1}/${tasks.length})</div>
        <div style="text-align:center;margin-bottom:20px">
          ${task.img?`<div id="cnt-img" style="margin-bottom:10px"></div>`:''}
          ${task.label?`<div style="font-size:14px;color:var(--text-2)">${escHtml(task.label)}</div>`:''}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          ${opts.map(n=>`<button class="player-opt cnt-opt" data-n="${n}" style="width:96px;height:96px;font-size:34px;font-weight:800;padding:0">${n}</button>`).join('')}
        </div></div></div>`;
      if(task.img){const d=await window.db.files.getImageData(task.img||task.image||'');if(d){const el=container.querySelector('#cnt-img');if(el)el.innerHTML=`<img src="${d}" style="height:180px;object-fit:contain;border-radius:var(--r-lg)">`;}}
      container.querySelectorAll('.cnt-opt').forEach(btn=>btn.addEventListener('click',()=>{const ok=+btn.dataset.n===+task.correct;if(ok){Sound.success();correct++;}else Sound.error();
        container.querySelectorAll('.cnt-opt').forEach(b=>{b.disabled=true;if(+b.dataset.n===+task.correct){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}idx++;setTimeout(next,900);}));
    }next();
  },

  // ── Сравни ────────────────────────────────────────────────────────────────
  compare(ex, content, container, onDone) {
    const tasks=content.tasks||[];if(!tasks.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    function next(){if(idx>=tasks.length){onDone({correct,total:tasks.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const task=tasks[idx];
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:640px;width:100%">
        <div class="player-question" style="margin-bottom:20px">${escHtml(task.question||'Что больше?')} (${idx+1}/${tasks.length})</div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;margin-bottom:24px">
          <div style="text-align:center;background:var(--surface);border:2px solid var(--border);border-radius:var(--r-xl);padding:20px"><div style="font-size:44px;font-weight:800">${escHtml(task.left||'?')}</div></div>
          <div id="cmp-sign" style="font-size:32px;color:var(--text-3)">?</div>
          <div style="text-align:center;background:var(--surface);border:2px solid var(--border);border-radius:var(--r-xl);padding:20px"><div style="font-size:44px;font-weight:800">${escHtml(task.right||'?')}</div></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center">
          ${['>','<','='].map(v=>`<button class="player-opt cmp-btn" data-v="${v}" style="width:96px;height:96px;font-size:36px;font-weight:800;padding:0">${v}</button>`).join('')}
        </div></div></div>`;
      container.querySelectorAll('.cmp-btn').forEach(btn=>btn.addEventListener('click',()=>{const ok=btn.dataset.v===task.answer;if(ok){Sound.success();correct++;}else Sound.error();
        container.querySelector('#cmp-sign').textContent=btn.dataset.v;container.querySelector('#cmp-sign').style.color=ok?'var(--green)':'var(--rose)';
        container.querySelectorAll('.cmp-btn').forEach(b=>{b.disabled=true;if(b.dataset.v===task.answer){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}idx++;setTimeout(next,1000);}));
    }next();
  },

  // ── Верно / Неверно ───────────────────────────────────────────────────────
  trueFalse(ex, content, container, onDone) {
    const stmts=[...(content.statements||[])].sort(()=>Math.random()-.5);if(!stmts.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет утверждений</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    async function next(){if(idx>=stmts.length){onDone({correct,total:stmts.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const s=stmts[idx];
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:620px;width:100%">
        <div class="player-question" style="margin-bottom:20px">Верно или нет? (${idx+1}/${stmts.length})</div>
        ${s.image||s.img?`<div id="tf-img" style="text-align:center;margin-bottom:16px"></div>`:''}
        <div style="font-size:22px;font-weight:500;text-align:center;line-height:1.6;max-width:400px;margin:0 auto 24px">${escHtml(s.statement||'')}</div>
        <div style="display:flex;gap:14px;justify-content:center">
          <button class="player-opt tf-btn" data-v="true" style="flex:1;max-width:180px;padding:20px;font-size:18px;font-weight:700;color:var(--green);border-color:var(--green)">✅ Верно</button>
          <button class="player-opt tf-btn" data-v="false" style="flex:1;max-width:180px;padding:20px;font-size:18px;font-weight:700;color:var(--rose);border-color:var(--rose)">❌ Неверно</button>
        </div></div></div>`;
      const imgP=s.image||s.img||'';if(imgP){const d=await window.db.files.getImageData(imgP);if(d){const el=container.querySelector('#tf-img');if(el)el.innerHTML=`<img src="${d}" style="height:170px;object-fit:contain;border-radius:var(--r-lg)">`;}}
      container.querySelectorAll('.tf-btn').forEach(btn=>btn.addEventListener('click',()=>{const ok=(btn.dataset.v==='true')===s.correct;if(ok){Sound.success();correct++;}else Sound.error();
        container.querySelectorAll('.tf-btn').forEach(b=>{b.disabled=true;if((b.dataset.v==='true')===s.correct){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}idx++;setTimeout(next,1000);}));
    }next();
  },


  // ── Слоги → слово ─────────────────────────────────────────────────────────
  async syllables(ex, content, container, onDone) {
    const items = (content.items || []).filter(it => it.syllables && it.syllables.length > 0);
    if (!items.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" style="margin-top:20px" id="sp-skip">Далее</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct: 0, total: 0, duration_sec: 0 }));
      return;
    }
    let idx = 0, correct = 0;
    const t0 = Date.now();

    async function render() {
      if (!container.isConnected) return;
      if (idx >= items.length) { onDone({ correct, total: items.length, duration_sec: Math.round((Date.now() - t0) / 1000) }); return; }
      const item = items[idx];
      const shuffledIdx = item.syllables.map((_, i) => i);
      for (let i = shuffledIdx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIdx[i], shuffledIdx[j]] = [shuffledIdx[j], shuffledIdx[i]];
      }
      let selected = [];
      const answer = item.syllables.join('');

      function refreshUI() {
        if (!container.isConnected) return;
        const done = selected.length === item.syllables.length;
        const wordEl = container.querySelector('#syl-word');
        if (wordEl) wordEl.textContent = selected.length ? selected.map(i => item.syllables[i]).join('') : '___';
        const slotsEl = container.querySelector('#syl-slots');
        if (slotsEl) {
          slotsEl.innerHTML = selected.map(i =>
            `<div class="syl-placed" data-i="${i}" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 20px;border-radius:var(--r-lg);border:2px solid var(--indigo);background:var(--indigo-l);font-size:22px;font-weight:800;color:var(--indigo);cursor:pointer;transition:all .15s;user-select:none">${escHtml(item.syllables[i])}</div>`
          ).join('');
          slotsEl.querySelectorAll('.syl-placed').forEach(ch => {
            ch.addEventListener('click', () => { selected = selected.filter(x => x !== +ch.dataset.i); Sound.match(); refreshUI(); });
          });
        }
        const poolEl = container.querySelector('#syl-pool');
        if (poolEl) {
          poolEl.innerHTML = shuffledIdx.filter(i => !selected.includes(i)).map(i =>
            `<div class="syl-chip" data-i="${i}" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 20px;border-radius:var(--r-lg);border:2px solid var(--border);background:var(--surface);font-size:22px;font-weight:800;cursor:pointer;transition:all .15s;user-select:none">${escHtml(item.syllables[i])}</div>`
          ).join('');
          poolEl.querySelectorAll('.syl-chip').forEach(ch => {
            ch.addEventListener('click', () => { selected.push(+ch.dataset.i); Sound.match(); refreshUI(); });
          });
        }
        const resetBtn = container.querySelector('#syl-reset');
        const checkBtn = container.querySelector('#syl-check');
        if (resetBtn) resetBtn.style.display = selected.length > 0 ? 'inline-flex' : 'none';
        if (checkBtn) checkBtn.style.display = done ? 'inline-flex' : 'none';
      }

      container.innerHTML = `<div class="player-body" style="overflow-y:auto">
        <div class="player-card" style="max-width:600px;width:100%;text-align:center">
          <div class="player-question" style="margin-bottom:8px">Собери слово из слогов</div>
          ${item.img ? `<img data-path="${escHtml(item.img)}" style="height:140px;object-fit:contain;border-radius:var(--r-lg);margin-bottom:14px">` : ''}
          <div id="syl-word" style="font-size:34px;font-weight:900;color:var(--indigo);letter-spacing:.04em;text-align:center;margin-bottom:6px;min-height:44px">___</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-3);text-align:center;margin-bottom:14px">Нажимай слоги по порядку · нажми ещё раз чтобы убрать</div>
          <div id="syl-slots" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;min-height:52px;margin-bottom:16px"></div>
          <div id="syl-pool" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:16px;background:var(--surface-2);border-radius:var(--r-xl);border:2px dashed var(--border);min-height:58px;margin-bottom:20px"></div>
          <div id="syl-fb" style="text-align:center;margin-bottom:12px;font-size:14px;font-weight:700;min-height:24px"></div>
          <div style="display:flex;justify-content:center;gap:10px">
            <button class="btn btn-ghost" id="syl-reset" style="display:none">↩ Сначала</button>
            <button class="btn btn-primary" id="syl-check" style="display:none">Проверить →</button>
          </div>
        </div></div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      container.querySelector('#syl-reset').addEventListener('click', () => {
        selected = []; const fb = container.querySelector('#syl-fb'); if (fb) fb.textContent = ''; refreshUI();
      });
      container.querySelector('#syl-check').addEventListener('click', () => {
        const assembled = selected.map(i => item.syllables[i]).join('');
        const isOk = assembled === answer;
        if (isOk) { correct++; Sound.success(); } else { Sound.error(); }
        const fb = container.querySelector('#syl-fb');
        if (fb) {
          fb.style.cssText = `padding:8px 16px;border-radius:var(--r-lg);display:inline-block;background:${isOk ? 'var(--green-l)' : 'var(--rose-l)'};color:${isOk ? 'var(--green)' : 'var(--rose)'};border:1.5px solid ${isOk ? '#B6E8D0' : '#F5BFBF'}`;
          fb.textContent = isOk ? '✓ Правильно! Отлично!' : `✗ Правильно: ${answer}`;
        }
        container.querySelectorAll('#syl-reset,#syl-check,.syl-chip,.syl-placed').forEach(b => b.style.pointerEvents = 'none');
        setTimeout(() => { idx++; render(); }, 1400);
      });
      refreshUI();
    }
    render();
  },

  // ── Место звука ──────────────────────────────────────────────────────────
  async soundPosition(ex, content, container, onDone) {
    const sound = content.sound || '';
    const items = (content.items || []).filter(it => it.word && it.position);
    if (!items.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" style="margin-top:20px" id="sp-skip">Далее</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct: 0, total: 0, duration_sec: 0 }));
      return;
    }
    const shuffled = [...items].sort(() => Math.random() - .5);
    let idx = 0, correct = 0;
    const t0 = Date.now();

    function posBar(pos) {
      const active = { start: 0, middle: 1, end: 2 }[pos];
      return `<div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;justify-content:center">
        ${[0,1,2].map(i => `<div style="width:14px;height:14px;border-radius:3px;border:2px solid currentColor;background:${i===active?'currentColor':'transparent'};transition:background .15s"></div>`).join('')}
      </div>`;
    }
    function highlightWord(word, snd) {
      if (!snd) return escHtml(word);
      const lo = word.toLowerCase(), s = snd.toLowerCase(), i = lo.indexOf(s);
      if (i < 0) return escHtml(word);
      return escHtml(word.slice(0, i)) + `<span style="color:var(--indigo);font-weight:900">${escHtml(word.slice(i, i + s.length))}</span>` + escHtml(word.slice(i + s.length));
    }

    async function render() {
      if (!container.isConnected) return;
      if (idx >= shuffled.length) { onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now() - t0) / 1000) }); return; }
      const item = shuffled[idx];
      const DEFS = [{ pos: 'start', label: 'Начало' }, { pos: 'middle', label: 'Середина' }, { pos: 'end', label: 'Конец' }];
      container.innerHTML = `<div class="player-body" style="overflow-y:auto">
        <div class="player-card" style="max-width:540px;width:100%;text-align:center">
          <div class="player-question" style="margin-bottom:10px">Где стоит звук <span style="color:var(--indigo)">[${escHtml(sound)}]</span>?</div>
          ${item.img ? `<div style="width:160px;height:160px;border-radius:var(--r-xl);background:var(--surface-2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;overflow:hidden"><img data-path="${escHtml(item.img)}" style="width:100%;height:100%;object-fit:contain"></div>` : ''}
          <div style="font-size:30px;font-weight:900;text-align:center;margin-bottom:24px;letter-spacing:.03em">${highlightWord(item.word, sound)}</div>
          <div style="display:flex;gap:16px;justify-content:center">
            ${DEFS.map(d => `<div class="sp-btn" data-pos="${d.pos}" style="width:120px;height:80px;border:2px solid var(--border);border-radius:var(--r-xl);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:all .15s;font-weight:800;color:var(--text-2);background:var(--surface)">${posBar(d.pos)}<span style="font-size:13px">${d.label}</span></div>`).join('')}
          </div>
          <div id="pos-fb" style="text-align:center;margin-top:20px;font-size:14px;font-weight:700;min-height:24px"></div>
        </div></div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      container.querySelectorAll('.sp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const isOk = btn.dataset.pos === item.position;
          if (isOk) { correct++; Sound.success(); } else { Sound.error(); }
          container.querySelectorAll('.sp-btn').forEach(b => {
            b.style.pointerEvents = 'none';
            if (b.dataset.pos === item.position) { b.style.borderColor = 'var(--green)'; b.style.background = 'var(--green-l)'; b.style.color = 'var(--green)'; }
            else if (b === btn) { b.style.borderColor = 'var(--rose)'; b.style.background = 'var(--rose-l)'; b.style.color = 'var(--rose)'; }
          });
          const fb = container.querySelector('#pos-fb');
          if (fb) { fb.style.color = isOk ? 'var(--green)' : 'var(--rose)'; fb.textContent = isOk ? '✓ Правильно!' : '✗ Попробуй ещё раз'; }
          setTimeout(() => { idx++; render(); }, 900);
        });
      });
    }
    render();
  },

  // ── Считай слоги ─────────────────────────────────────────────────────────
  async syllableCount(ex, content, container, onDone) {
    const items = (content.items || []).filter(it => it.word && it.count > 0);
    if (!items.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" style="margin-top:20px" id="sp-skip">Далее</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct: 0, total: 0, duration_sec: 0 }));
      return;
    }
    const shuffled = [...items].sort(() => Math.random() - .5);
    let idx = 0, correct = 0;
    const t0 = Date.now();

    async function render() {
      if (!container.isConnected) return;
      if (idx >= shuffled.length) { onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now() - t0) / 1000) }); return; }
      const item = shuffled[idx];
      let taps = 0, locked = false;

      container.innerHTML = `<div class="player-body" style="overflow-y:auto">
        <div class="player-card" style="max-width:480px;width:100%;text-align:center">
          <div class="player-question" style="margin-bottom:8px">Сколько слогов?</div>
          ${item.img ? `<div style="width:160px;height:160px;border-radius:var(--r-xl);background:var(--surface-2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;overflow:hidden"><img data-path="${escHtml(item.img)}" style="width:100%;height:100%;object-fit:contain"></div>` : ''}
          <div style="font-size:38px;font-weight:900;text-align:center;margin-bottom:4px">${escHtml(item.word)}</div>
          <div id="sc-counter" style="font-size:64px;font-weight:900;text-align:center;color:var(--indigo);line-height:1;margin:12px 0;min-height:72px">0</div>
          <div id="sc-dots" style="display:flex;gap:6px;justify-content:center;min-height:22px;margin-bottom:20px"></div>
          <button id="sc-tap" style="width:120px;height:120px;border-radius:50%;border:none;background:var(--indigo);color:#fff;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;transition:transform .1s;box-shadow:0 6px 20px rgba(91,91,214,.35);margin:0 auto;-webkit-tap-highlight-color:transparent;touch-action:manipulation">
            <span style="font-size:28px">👏</span><span style="font-size:13px">Хлопни!</span>
          </button>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
            <button class="btn btn-ghost" id="sc-reset">↩ Сброс</button>
            <button class="btn btn-primary" id="sc-check" style="display:none">Проверить →</button>
          </div>
          <div id="sc-fb" style="text-align:center;margin-top:16px;font-size:14px;font-weight:700;min-height:24px"></div>
        </div></div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      const tapBtn  = container.querySelector('#sc-tap');
      const counter = container.querySelector('#sc-counter');
      const dots    = container.querySelector('#sc-dots');
      const checkBtn = container.querySelector('#sc-check');
      const resetBtn = container.querySelector('#sc-reset');
      const fb      = container.querySelector('#sc-fb');

      tapBtn.addEventListener('click', () => {
        if (locked) return;
        taps++;
        Sound.match();
        tapBtn.style.transform = 'scale(.88)';
        setTimeout(() => { if (tapBtn && tapBtn.isConnected) tapBtn.style.transform = 'scale(1)'; }, 100);
        counter.textContent = taps;
        dots.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:var(--indigo);opacity:.8"></div>`.repeat(taps);
        checkBtn.style.display = 'inline-flex';
      });
      resetBtn.addEventListener('click', () => {
        taps = 0; counter.textContent = '0'; dots.innerHTML = ''; checkBtn.style.display = 'none'; fb.textContent = '';
      });
      checkBtn.addEventListener('click', () => {
        if (locked) return; locked = true;
        const isOk = taps === item.count;
        if (isOk) { correct++; Sound.success(); } else { Sound.error(); }
        fb.style.cssText = `padding:8px 16px;border-radius:var(--r-lg);display:inline-block;background:${isOk ? 'var(--green-l)' : 'var(--rose-l)'};color:${isOk ? 'var(--green)' : 'var(--rose)'};border:1.5px solid ${isOk ? '#B6E8D0' : '#F5BFBF'}`;
        fb.textContent = isOk ? `✓ Правильно! ${item.count} ${item.count === 1 ? 'слог' : item.count < 5 ? 'слога' : 'слогов'}` : `✗ Правильно: ${item.count}`;
        [tapBtn, resetBtn, checkBtn].forEach(b => { if (b) b.style.pointerEvents = 'none'; });
        setTimeout(() => { idx++; render(); }, 1400);
      });
    }
    render();
  },

  // ── Подпиши картинку ─────────────────────────────────────────────────────
  async labelImage(ex, content, container, onDone) {
    const img       = content.img || '';
    const hotspots  = content.hotspots || [];
    const allLabels = content.labels || [];
    if (!img || !hotspots.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет картинки или маркеров</div><button class="btn btn-primary" style="margin-top:20px" id="sp-skip">Далее</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct: 0, total: 0, duration_sec: 0 }));
      return;
    }
    const t0             = Date.now();
    const solved         = {};
    const wrongOnce      = new Set();
    let selected         = null;
    const shuffledLabels = [...allLabels].sort(() => Math.random() - .5);

    async function render() {
      if (!container.isConnected) return;
      const allDone = hotspots.every(h => solved[h.id]);
      if (allDone) {
        onDone({ correct: hotspots.filter(h => !wrongOnce.has(String(h.id))).length, total: hotspots.length, duration_sec: Math.round((Date.now() - t0) / 1000) });
        return;
      }
      container.innerHTML = `<div class="player-body" style="overflow-y:auto">
        <div class="player-card" style="max-width:680px;width:100%;text-align:center">
          <div class="player-question" style="margin-bottom:14px">Нажми на маркер, потом выбери подпись</div>
          <div style="position:relative;max-width:380px;margin:0 auto 16px;display:inline-block">
            <img id="li-img" data-path="${escHtml(img)}" style="width:100%;max-height:240px;object-fit:contain;border-radius:var(--r-xl);border:2px solid var(--border);display:block">
            ${hotspots.map((h, i) => {
              const isSolved = !!solved[h.id];
              const isSel    = selected === h.id;
              const bg       = isSolved ? 'var(--green)' : 'var(--indigo)';
              const scale    = isSel ? 'translate(-50%,-50%) scale(1.3)' : 'translate(-50%,-50%) scale(1)';
              return `<div class="li-marker" data-id="${escHtml(h.id)}" style="position:absolute;left:${h.x}%;top:${h.y}%;transform:${scale};width:26px;height:26px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 2px 8px rgba(91,91,214,.4);cursor:${isSolved?'default':'pointer'};pointer-events:${isSolved?'none':'auto'};display:flex;align-items:center;justify-content:center;transition:transform .15s,background .15s">
                <span style="color:#fff;font-size:11px;font-weight:900">${i + 1}</span>
                ${isSolved ? `<div style="position:absolute;background:var(--indigo);color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;white-space:nowrap;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);pointer-events:none">${escHtml(solved[h.id])}</div>` : ''}
              </div>`;
            }).join('')}
          </div>
          <div id="hs-hint" style="font-size:13px;font-weight:700;color:var(--text-3);text-align:center;margin-bottom:12px">
            ${selected ? `Маркер ${hotspots.findIndex(h => String(h.id) === selected) + 1} выбран — нажми подпись` : 'Выбери маркер на картинке'}
          </div>
          <div id="li-labels" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
            ${shuffledLabels.map((l, li) => {
              const isPlaced = Object.values(solved).includes(l);
              return `<div class="li-lbl" data-li="${li}" data-lbl="${escHtml(l)}" style="padding:8px 16px;border-radius:var(--r-lg);border:2px solid var(--border);background:var(--surface);font-size:14px;font-weight:700;cursor:${isPlaced?'default':'pointer'};opacity:${isPlaced?'.3':'1'};pointer-events:${isPlaced?'none':'auto'};transition:all .15s">${escHtml(l)}</div>`;
            }).join('')}
          </div>
        </div></div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      container.querySelectorAll('.li-marker').forEach(m => {
        m.addEventListener('click', () => { selected = m.dataset.id; render(); });
      });
      container.querySelectorAll('.li-lbl').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!selected) return;
          const lbl  = btn.dataset.lbl;
          const hs   = hotspots.find(h => String(h.id) === selected);
          const isOk = hs && hs.label === lbl;
          if (isOk) {
            solved[selected] = lbl; selected = null; Sound.success(); render();
          } else {
            wrongOnce.add(selected); Sound.error();
            btn.style.borderColor = 'var(--rose)'; btn.style.background = 'var(--rose-l)';
            setTimeout(() => { if (btn.isConnected) { btn.style.borderColor = ''; btn.style.background = ''; } }, 700);
          }
        });
      });
    }
    render();
  },

  // ── Да / Нет ───────────────────────────────────────────────────────────────
  async yesNo(ex, content, container, onDone) {
    const question = content.question || '';
    const items    = content.items || [];
    if (!items.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет карточек</div><button class="btn btn-primary" style="margin-top:20px" id="sp-skip">Далее</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({ correct: 0, total: 0, duration_sec: 0 }));
      return;
    }
    const shuffled = [...items].sort(() => Math.random() - .5);
    let idx = 0, correct = 0;
    const t0 = Date.now();

    async function render() {
      if (!container.isConnected) return;
      if (idx >= shuffled.length) { onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now() - t0) / 1000) }); return; }
      const item = shuffled[idx];
      container.innerHTML = `<div class="player-body" style="overflow-y:auto">
        <div class="player-card" style="max-width:480px;width:100%;text-align:center">
          ${question ? `<div class="player-question" style="margin-bottom:8px">${escHtml(question)}</div>` : ''}
          <div id="yn-card" style="width:240px;height:180px;border:2px solid var(--border);border-radius:var(--r-2xl);background:var(--surface-2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;margin:0 auto 24px;transition:transform .2s,border-color .2s">
            ${item.img ? `<img data-path="${escHtml(item.img)}" style="height:110px;object-fit:contain;border-radius:var(--r-lg)">` : `<div style="font-size:60px;line-height:1">${escHtml(item.label || '')}</div>`}
            ${item.label && item.img ? `<div style="font-size:14px;font-weight:700;color:var(--text-2)">${escHtml(item.label)}</div>` : ''}
          </div>
          <div id="yn-fb" style="text-align:center;min-height:20px;font-size:14px;font-weight:700;margin-bottom:16px"></div>
          <div style="display:flex;gap:20px;justify-content:center">
            <button class="yn-yes" data-ans="true" style="width:120px;height:60px;border-radius:var(--r-xl);background:var(--green-l);color:var(--green);border:2px solid var(--green);cursor:pointer;font-size:20px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s">✓ Да</button>
            <button class="yn-no"  data-ans="false" style="width:120px;height:60px;border-radius:var(--r-xl);background:var(--rose-l);color:var(--rose);border:2px solid var(--rose);cursor:pointer;font-size:20px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s">✗ Нет</button>
          </div>
        </div></div>`;
      if (!container.isConnected) return;
      await loadPlayerImages(container);
      if (!container.isConnected) return;

      container.querySelectorAll('.yn-yes,.yn-no').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen = btn.dataset.ans === 'true';
          const isOk   = chosen === item.answer;
          if (isOk) { correct++; Sound.success(); } else { Sound.error(); }
          const card = container.querySelector('#yn-card');
          if (card) {
            card.style.transform = chosen ? 'rotate(-6deg) translateX(-10px)' : 'rotate(6deg) translateX(10px)';
            card.style.borderColor = isOk ? 'var(--green)' : 'var(--rose)';
          }
          const fb = container.querySelector('#yn-fb');
          if (fb) { fb.style.color = isOk ? 'var(--green)' : 'var(--rose)'; fb.textContent = isOk ? '✓ Правильно!' : '✗ Нет…'; }
          container.querySelectorAll('.yn-yes,.yn-no').forEach(b => b.style.pointerEvents = 'none');
          setTimeout(() => { idx++; render(); }, 700);
        });
      });
    }
    render();
  },

});
