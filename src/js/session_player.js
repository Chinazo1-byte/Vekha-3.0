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

  // ── Visual Match ────────────────────────────────────────────────────────────
  visualMatch(ex, content, container, onDone) {
    const items = content.items || [];
    if (!items.length) {
      container.innerHTML = `<div class="player-body"><div class="player-card" style="text-align:center">
        <div style="color:var(--text-3);font-size:16px;margin-bottom:20px">Упражнение пусто — добавьте задания в редакторе.</div>
        <button class="btn btn-primary" id="sp-empty-next">Продолжить</button>
      </div></div>`;
      container.querySelector('#sp-empty-next').addEventListener('click', () => onDone({ correct:0, total:0, duration_sec:0 }));
      return;
    }

    const shuffled = [...items].sort(() => Math.random() - .5);
    let idx = 0, correct = 0;
    const answers = [];
    const t0 = Date.now();

    function render() {
      if (idx >= shuffled.length) {
        onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now()-t0)/1000), answers });
        return;
      }
      const item = shuffled[idx];
      let opts = [{ text: item.answer, img: item.answer_img, correct: true }];
      const pool = items.filter(it => it !== item).map(it => ({ text: it.answer, img: it.answer_img, correct: false }));
      const dist = (item.distractors||[]).map(d => ({ text: d, img:'', correct: false }));
      opts = [...opts, ...[...dist,...pool].sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5).slice(0,4);

      container.innerHTML = `
        <div class="player-body">
          <div class="player-card">
            <div class="player-question">
              ${item.question_img ? `<img data-path="${escHtml(item.question_img)}" style="max-width:260px;max-height:160px;border-radius:12px;object-fit:contain;display:block;margin:0 auto 12px">` : ''}
              ${item.question ? escHtml(item.question) : ''}
            </div>
            <div class="player-options cols-2">
              ${opts.map((o,i) => `
                <div class="player-opt" data-i="${i}" data-correct="${o.correct}">
                  ${o.img ? `<img data-path="${escHtml(o.img)}" style="width:110px;height:150px;object-fit:cover;border-radius:10px">` : ''}
                  ${o.text ? escHtml(o.text) : ''}
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      loadPlayerImages(container);
      container.querySelectorAll('.player-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          const ok = opt.dataset.correct === 'true';
          opt.classList.add(ok ? 'correct' : 'wrong');
          if (ok) Sound.success(); else Sound.error();
          if (!ok) container.querySelectorAll('.player-opt').forEach(o => { if (o.dataset.correct==='true') o.classList.add('correct'); });
          else correct++;
          answers.push({ question: item.question, is_correct: ok });
          container.querySelectorAll('.player-opt').forEach(o => o.classList.add('disabled'));
          setTimeout(() => { idx++; render(); }, 900);
        });
      });
    }
    render();
  },

  // ── Find Pairs ──────────────────────────────────────────────────────────────
  findPairs(ex, content, container, onDone) {
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
      container.innerHTML = `
        <div class="player-body">
          <div class="player-card">
            <div style="font-family:var(--font-title);font-size:18px;text-align:center;margin-bottom:20px">Найди все пары</div>
            <div class="pairs-grid">
              ${cards.map(c => `
                <div class="pair-card ${matched.has(c.id)?'matched':''}" data-id="${c.id}">
                  ${matched.has(c.id)
                    ? (c.img ? `<img data-path="${escHtml(c.img)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : escHtml(c.text||'✓'))
                    : `<span style="font-size:22px;color:var(--text-3)">?</span>`}
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      await loadPlayerImages(container);

      container.querySelectorAll('.pair-card:not(.matched)').forEach(card => {
        card.addEventListener('click', async () => {
          if (locked || flipped.length >= 2) return;
          const cid = +card.dataset.id;
          if (flipped.includes(cid)) return;
          flipped.push(cid);
          const cd = cards.find(c => c.id === cid);
          card.classList.add('flipped');
          card.innerHTML = cd.img
            ? `<img data-path="${escHtml(cd.img)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`
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
                  ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:90px;height:90px;object-fit:cover;border-radius:10px">` : ''}
                  ${it.text ? `<span>${escHtml(it.text)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;

      await loadPlayerImages(container);
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
  sorting(ex, content, container, onDone) {
    const cats  = content.categories || [];
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
    let remaining = [...shuffled], selected = null, placed = {}, correct = 0;
    const t0 = Date.now();
    cats.forEach(c => placed[c] = []);

    async function render() {
      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto">
          <div class="player-card" style="max-width:840px;width:100%">
            <div style="font-family:var(--font-title);font-size:18px;text-align:center;margin-bottom:20px">Разложи по группам</div>
            <div class="sort-source">
              ${remaining.map((it,i) => `
                <div class="sort-chip" data-i="${i}">
                  ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:4px">` : ''}
                  ${escHtml(it.text||'')}
                </div>`).join('')}
              ${!remaining.length ? '<span style="color:var(--text-3);font-size:13px">Все распределены</span>' : ''}
            </div>
            <div class="sort-buckets" style="grid-template-columns:repeat(${Math.min(cats.length,3)},1fr)">
              ${cats.map(cat => `
                <div class="sort-bucket" data-cat="${escHtml(cat)}">
                  <div class="sort-bucket-title">${escHtml(cat)}</div>
                  <div class="sort-bucket-items">
                    ${(placed[cat]||[]).map(it => `<div class="sort-placed ${it.category===cat?'':'wrong'}">${escHtml(it.text||'?')}</div>`).join('')}
                  </div>
                </div>`).join('')}
            </div>
            ${!remaining.length ? `
              <div style="text-align:center;margin-top:20px">
                <button class="btn btn-primary" id="sp-sort-done">Готово</button>
              </div>` : ''}
          </div>
        </div>`;

      await loadPlayerImages(container);

      container.querySelectorAll('.sort-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          container.querySelectorAll('.sort-chip').forEach(c => c.classList.remove('selected-chip'));
          chip.classList.add('selected-chip');
          selected = remaining[+chip.dataset.i];
        });
      });
      container.querySelectorAll('.sort-bucket').forEach(bucket => {
        bucket.addEventListener('click', () => {
          if (!selected) return;
          const cat = bucket.dataset.cat;
          placed[cat].push(selected);
          remaining = remaining.filter(it => it !== selected);
          if (selected.category === cat) correct++;
          selected = null;
          render();
        });
      });
      container.querySelector('#sp-sort-done')?.addEventListener('click', () => {
        onDone({ correct, total: shuffled.length, duration_sec: Math.round((Date.now()-t0)/1000) });
      });
    }
    render();
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
      find_pairs:    () => SpTypes.findPairs(ex, { ...c, pairs: (c.cards||c.pairs||[]).map((p,i)=>({...p,a_text:p.text||p.a_text||'',b_text:p.text||p.b_text||'',a_img:p.image||p.img||p.a_img||'',b_img:p.image||p.img||p.b_img||'',pairId:i})) }, container, onDone),
      odd_one_out:   () => SpTypes.oddOneOut(ex, { ...c, tasks: (c.tasks||[]).map(t=>({...t,items:(t.items||[]).map(it=>({...it,img:it.img||it.image||''}))}) ) }, container, onDone),
      sorting:       () => SpTypes.sorting(ex, {
          categories: (c.categories||[]).map(cat=>cat.name||cat),
          items: norm(c.items||[]).map(it=>({ ...it, category: c.categories?.[it.category]?.name || c.categories?.[it.category] || it.category })),
        }, container, onDone),
      categories:    () => SpTypes.categories(ex, c, container, onDone),
      sequencing:    () => SpTypes.sequencing(ex, { ...c, items: norm(c.items||[]) }, container, onDone),
      story_order:   () => SpTypes.storyOrder(ex, { ...c, items: norm(c.panels||c.items||[]) }, container, onDone),
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
      emotion_match: () => SpTypes.emotionMatch(ex, c, container, onDone),
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
      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto">
          <div class="player-card" style="max-width:840px;width:100%">
            <div class="player-question" style="margin-bottom:20px">Расставь по порядку</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;min-height:90px;
              background:var(--surface-2);border:2px dashed var(--border);border-radius:var(--r-lg);padding:10px;margin-bottom:16px">
              ${selected.map((origIdx,pos) => {
                const item = items[origIdx];
                return `<div class="seq-placed" data-pos="${pos}" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;
                  padding:8px;border-radius:var(--r-lg);border:2px solid var(--indigo);background:var(--indigo-l);min-width:70px;text-align:center">
                  <div style="font-size:10px;font-weight:700;color:var(--indigo)">${pos+1}</div>
                  ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:96px;height:96px;object-fit:cover;border-radius:8px">` : ''}
                  ${item.label ? `<div style="font-size:11px;color:var(--indigo);font-weight:600">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('') || '<div style="color:var(--text-3);font-size:13px;margin:auto">Нажимайте на элементы ниже</div>'}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:20px">
              ${order.map((origIdx) => {
                const item = items[origIdx];
                const placed = selected.includes(origIdx);
                return `<div class="${placed?'':'seq-opt'}" data-orig="${origIdx}" style="display:flex;flex-direction:column;align-items:center;gap:4px;
                  cursor:${placed?'default':'pointer'};opacity:${placed?.2:1};padding:8px;border-radius:var(--r-lg);
                  border:2px solid var(--border);background:var(--surface);min-width:70px;text-align:center">
                  ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:96px;height:96px;object-fit:cover;border-radius:8px">` : ''}
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
      await loadPlayerImages(container);
      container.querySelectorAll('.seq-opt').forEach(opt => opt.addEventListener('click', () => { selected.push(+opt.dataset.orig); render(); }));
      container.querySelectorAll('.seq-placed').forEach(p => p.addEventListener('click', () => { selected.splice(+p.dataset.pos,1); render(); }));
      container.querySelector('#seq-undo')?.addEventListener('click', () => { selected.pop(); render(); });
      container.querySelector('#seq-check')?.addEventListener('click', () => {
        const correct = selected.filter((origIdx,pos) => origIdx===pos).length;
        onDone({ correct, total: items.length, duration_sec: Math.round((Date.now()-t0)/1000) });
      });
    }
    render();
  },

  // ── История по порядку ────────────────────────────────────────────────────
  storyOrder(ex, content, container, onDone) {
    SpTypes.sequencing(ex, content, container, onDone);
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
    const correctOrder = [...items].sort((a,b) => dir==='asc' ? a.size-b.size : b.size-a.size);
    const shuffled     = [...items].sort(() => Math.random()-.5);
    let   order        = [...Array(shuffled.length).keys()];
    let   selPos       = null;
    const t0           = Date.now();

    async function render() {
      container.innerHTML = `
        <div class="player-body" style="overflow-y:auto">
          <div class="player-card" style="max-width:840px;width:100%">
            <div class="player-question" style="margin-bottom:20px">${dir==='asc'?'От меньшего к большему →':'← От большего к меньшему'}</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;align-items:flex-end">
              ${order.map((si,pos) => {
                const item = shuffled[si];
                const isSel = selPos===pos;
                return `<div class="so-item" data-pos="${pos}" style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;
                  padding:10px;border-radius:var(--r-xl);border:2px solid ${isSel?'var(--indigo)':'var(--border)'};
                  background:${isSel?'var(--indigo-l)':'var(--surface)'};min-width:78px;text-align:center">
                  <div style="font-size:10px;font-weight:700;color:${isSel?'var(--indigo)':'var(--text-3)'}">${pos+1}</div>
                  ${item.img ? `<img data-path="${escHtml(item.img)}" style="width:106px;height:106px;object-fit:contain;border-radius:8px">` : ''}
                  ${item.label ? `<div style="font-size:11px;color:var(--text-2)">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            <div style="text-align:center;font-size:12px;color:var(--text-3);margin-bottom:12px">Нажми два элемента, чтобы поменять местами</div>
            <div style="text-align:center"><button class="btn btn-primary" id="so-check">Проверить →</button></div>
          </div>
        </div>`;
      await loadPlayerImages(container);
      container.querySelectorAll('.so-item').forEach(el => {
        el.addEventListener('click', () => {
          const pos = +el.dataset.pos;
          if (selPos===null) { selPos=pos; render(); }
          else { [order[selPos],order[pos]]=[order[pos],order[selPos]]; selPos=null; render(); }
        });
      });
      container.querySelector('#so-check').addEventListener('click', () => {
        const correct = order.filter((si,pos) => shuffled[si].label===correctOrder[pos].label).length;
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
  pattern(ex, content, container, onDone) {
    const seqs = content.sequences || [];
    if (!seqs.length) {
      container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет рядов</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;
      container.querySelector('#sp-skip').addEventListener('click', () => onDone({correct:0,total:0,duration_sec:0}));
      return;
    }
    let idx=0, correct=0; const t0=Date.now();
    function next() {
      if (idx>=seqs.length) { onDone({correct,total:seqs.length,duration_sec:Math.round((Date.now()-t0)/1000)}); return; }
      const seq=seqs[idx];
      const opts=[...seq.options].map((v,i)=>({v,i})).sort(()=>Math.random()-.5);
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:720px;width:100%">
        <div class="player-question" style="margin-bottom:20px">Что идёт дальше? (${idx+1}/${seqs.length})</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:24px">
          ${seq.items.map(v=>`<div style="width:54px;height:80px;border-radius:var(--r-md);background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:22px">${escHtml(String(v))}</div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${opts.map(opt=>`<button class="player-opt pat-opt" data-i="${opt.i}" style="width:82px;height:82px;font-size:26px;font-weight:800;padding:0;display:flex;align-items:center;justify-content:center">${escHtml(String(opt.v))}</button>`).join('')}
        </div></div></div>`;
      container.querySelectorAll('.pat-opt').forEach(btn=>btn.addEventListener('click',()=>{
        const ok=+btn.dataset.i===seq.answer;
        if(ok) correct++;
        container.querySelectorAll('.pat-opt').forEach(b=>{b.disabled=true; if(+b.dataset.i===seq.answer){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}
        idx++; setTimeout(next,1000);
      }));
    }
    next();
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
    const words=content.words||[];if(!words.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет слов</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    function nextWord(){if(idx>=words.length){onDone({correct,total:words.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const wordObj=words[idx];const letters=(wordObj.word||'').split('');if(!letters.length){idx++;nextWord();return;}
      const shuffled=letters.map((l,i)=>({l,i})).sort(()=>Math.random()-.5);let built=[];
      function render(){
        container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:680px;width:100%">
          <div class="player-question" style="margin-bottom:8px">Составь слово (${idx+1}/${words.length})</div>
          ${wordObj.hint?`<div style="font-size:13px;color:var(--text-3);margin-bottom:12px">${escHtml(wordObj.hint)}</div>`:''}
          <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;min-height:80px;background:var(--surface-2);border-radius:var(--r-lg);padding:8px;margin-bottom:16px">
            ${built.map((lt,i)=>`<div class="wb-placed" data-pos="${i}" style="width:58px;height:58px;border-radius:var(--r-md);background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;cursor:pointer">${escHtml(lt.l)}</div>`).join('')||'<div style="color:var(--text-3);font-size:13px;margin:auto">Нажимай на буквы</div>'}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:16px">
            ${shuffled.map((lt,si)=>{const used=built.some(b=>b.si===si);return`<button class="wb-btn" data-si="${si}" ${used?'disabled':''} style="width:58px;height:58px;border-radius:var(--r-md);border:2px solid ${used?'var(--border)':'var(--indigo)'};background:${used?'var(--surface-2)':'var(--indigo-l)'};color:${used?'var(--text-3)':'var(--indigo)'};font-size:20px;font-weight:700;cursor:${used?'default':'pointer'}">${used?'':escHtml(lt.l)}</button>`;}).join('')}
          </div>
          <div style="text-align:center;display:flex;gap:8px;justify-content:center">
            <button class="btn btn-ghost" id="wb-clear">Очистить</button>
            <button class="btn btn-primary" id="wb-check" ${built.length!==letters.length?'disabled':''}>Проверить →</button>
          </div></div></div>`;
        container.querySelector('#wb-clear').addEventListener('click',()=>{built=[];render();});
        container.querySelector('#wb-check')?.addEventListener('click',()=>{
          const ok=built.map(b=>b.l).join('')===wordObj.word;if(ok){Sound.win();correct++;}else Sound.error();
          const builtEls=container.querySelectorAll('.wb-placed');builtEls.forEach(el=>{el.style.background=ok?'var(--green)':'var(--rose)';});
          idx++;setTimeout(nextWord,900);});
        container.querySelectorAll('.wb-btn:not([disabled])').forEach((btn,bi)=>btn.addEventListener('click',()=>{built.push({l:shuffled[+btn.dataset.si].l,si:+btn.dataset.si});render();}));
        container.querySelectorAll('.wb-placed').forEach((el,i)=>el.addEventListener('click',()=>{built.splice(i,1);render();}));
      }render();
    }nextWord();
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

  // ── Назови эмоцию ─────────────────────────────────────────────────────────
  emotionMatch(ex, content, container, onDone) {
    const tasks=content.tasks||[];if(!tasks.length){container.innerHTML=`<div class="player-body"><div class="player-card" style="text-align:center"><div style="color:var(--text-3)">Нет заданий</div><button class="btn btn-primary" id="sp-skip">Пропустить</button></div></div>`;container.querySelector('#sp-skip').addEventListener('click',()=>onDone({correct:0,total:0,duration_sec:0}));return;}
    let idx=0,correct=0;const t0=Date.now();
    async function next(){if(idx>=tasks.length){onDone({correct,total:tasks.length,duration_sec:Math.round((Date.now()-t0)/1000)});return;}
      const task=tasks[idx];const emos=[...(task.emotions||[])].sort(()=>Math.random()-.5);
      container.innerHTML=`<div class="player-body" style="overflow-y:auto"><div class="player-card" style="max-width:660px;width:100%">
        <div class="player-question" style="margin-bottom:20px">Что чувствует? (${idx+1}/${tasks.length})</div>
        ${task.image||task.img?`<div id="em-img" style="text-align:center;margin-bottom:12px"></div>`:''}
        ${task.situation?`<div style="font-size:15px;line-height:1.6;max-width:440px;margin:0 auto 20px;text-align:center">${escHtml(task.situation)}</div>`:''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${emos.map((e,ei)=>`<button class="player-opt em-opt" data-i="${ei}" style="padding:12px 18px;font-size:15px">${escHtml(e.label||'')}</button>`).join('')}
        </div></div></div>`;
      const imgP=task.image||task.img||'';if(imgP){const d=await window.db.files.getImageData(imgP);if(d){const el=container.querySelector('#em-img');if(el)el.innerHTML=`<img src="${d}" style="height:160px;object-fit:contain;border-radius:var(--r-lg)">`;}}
      container.querySelectorAll('.em-opt').forEach((btn,bi)=>btn.addEventListener('click',()=>{const ok=emos[bi].correct;if(ok){Sound.success();correct++;}else Sound.error();
        container.querySelectorAll('.em-opt').forEach((b,bj)=>{b.disabled=true;if(emos[bj].correct){b.style.background='var(--green-l)';b.style.borderColor='var(--green)';}});
        if(!ok){btn.style.background='var(--rose-l)';btn.style.borderColor='var(--rose)';}idx++;setTimeout(next,1100);}));
    }next();
  },
});
