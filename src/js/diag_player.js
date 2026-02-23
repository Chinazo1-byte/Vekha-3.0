// ══════════════════════════════════════════════════════════════════════════════
//  ПЛЕЕР ДИАГНОСТИК v3 — интерфейсы для каждой методики
// ══════════════════════════════════════════════════════════════════════════════

const DiagPlayer = {
  _el: null,

  async start(diagId, studentId) {
    const d = await window.db.diagnostics.get(diagId);
    if (!d) { toast('Методика не найдена', 'error'); return; }

    const student  = studentId ? await window.db.students.get(studentId) : null;
    const methodId = d.method_id; // встроенная методика

    // Встроенная методика → специальный UI
    if (methodId && DIAG_METHODS[methodId]) {
      this._runBuiltin(d, DIAG_METHODS[methodId], student);
      return;
    }

    // Пользовательская (из редактора) → универсальный UI
    let questions = [];
    try { questions = JSON.parse(d.questions || '[]'); } catch(e) {}
    if (!questions.length) { toast('В методике нет вопросов. Откройте редактор.', 'error'); return; }
    this._runCustom(d, questions, student);
  },

  close() { this._el?.remove(); this._el = null; },

  _makeOverlay(title, studentName) {
    this._el?.remove();
    const el = document.createElement('div');
    el.className = 'player-overlay';
    document.body.appendChild(el);
    this._el = el;

    el.innerHTML = `
      <div class="player-topbar" id="dp-topbar">
        <button class="btn btn-ghost btn-sm" id="dp-close">Закрыть</button>
        <div style="font-size:14px;font-weight:600;color:var(--text-1)">${escHtml(title)}</div>
        ${studentName ? `<div style="font-size:13px;color:var(--text-3)">Ученик: <b style="color:var(--text-1)">${escHtml(studentName)}</b></div>` : ''}
        <div id="dp-topbar-right" style="margin-left:auto"></div>
      </div>
      <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:32px 48px" id="dp-body">
      </div>`;

    el.querySelector('#dp-close').addEventListener('click', () => this.close());
    return el;
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  ВСТРОЕННЫЕ МЕТОДИКИ
  // ════════════════════════════════════════════════════════════════════════════
  _runBuiltin(diag, method, student) {
    const sName = student ? `${student.first_name} ${student.last_name||''}` : null;
    this._makeOverlay(method.name, sName);
    DiagUIs[method.id]?.(this._el, (rawData) => this._finishBuiltin(diag, method, student, rawData));
  },

  async _finishBuiltin(diag, method, student, rawData) {
    const scores = method.score(rawData);
    const interp = method.interpret(scores);
    const summary = this._buildSummaryText(interp);

    // Сохраняем результат (diagnostic_id может быть null для встроенных без БД-записи)
    if (student?.id) {
      await window.db.diagnostics.saveResult({
        diagnostic_id: diag.id || null,
        student_id:    student.id,
        answers:       rawData,
        scores,
        summary,
        method_id:     method.id,
        method_name:   method.name,
      });
    }

    this._showResultScreen(method, scores, interp, student);
  },

  _buildSummaryText(interp) {
    const lines = [...(interp.markers||[]), ...(interp.risks||[])];
    return lines.slice(0, 3).join(' | ');
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  ЭКРАН РЕЗУЛЬТАТА
  // ════════════════════════════════════════════════════════════════════════════
  _showResultScreen(method, scores, interp, student) {
    const el = this._el;
    const levelColor = { norm: 'var(--green)', attention: 'var(--amber)', risk: 'var(--rose)', unknown: 'var(--text-3)' };
    const levelLabel = { norm: 'Норма', attention: 'Обратить внимание', risk: 'Требует консультации', unknown: '—' };
    const levelBg    = { norm: 'var(--green-l)', attention: 'var(--amber-l)', risk: 'var(--rose-l)', unknown: 'var(--surface-2)' };

    const col = levelColor[interp.level] || levelColor.unknown;
    const bg  = levelBg[interp.level]  || levelBg.unknown;
    const lbl = levelLabel[interp.level] || '—';

    el.innerHTML = `
      <div class="player-topbar">
        <div style="font-size:15px;font-weight:600">Результат: ${escHtml(method.name)}</div>
      </div>
      <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:32px 48px">
        <div style="width:100%;max-width:680px">

          <!-- Вердикт -->
          <div style="background:${bg};border-radius:var(--r-xl);padding:20px 24px;margin-bottom:20px;border:1px solid ${col}30">
            <div style="font-size:12px;font-weight:700;color:${col};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">
              Итоговая оценка
            </div>
            <div style="font-size:20px;font-weight:700;color:${col}">${lbl}</div>
            ${interp.vkText ? `<div style="font-size:13.5px;color:var(--text-2);margin-top:8px">${escHtml(interp.vkText)}</div>` : ''}
          </div>

          <!-- Маркеры -->
          ${(interp.markers||[]).length ? `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px;margin-bottom:16px">
              <div style="font-size:12px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Показатели</div>
              ${interp.markers.map(m => `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
                  <span style="color:var(--indigo);margin-top:2px">▸</span>
                  <span style="font-size:13.5px;color:var(--text-1);line-height:1.5">${escHtml(m)}</span>
                </div>`).join('')}
            </div>` : ''}

          <!-- Риски -->
          ${(interp.risks||[]).length ? `
            <div style="background:var(--rose-l);border:1px solid #FECACA;border-radius:var(--r-xl);padding:20px;margin-bottom:16px">
              <div style="font-size:12px;font-weight:700;color:var(--rose);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Маркеры риска</div>
              ${interp.risks.map(r => `
                <div style="font-size:13.5px;color:var(--rose);margin-bottom:6px;line-height:1.5">${escHtml(r)}</div>`).join('')}
            </div>` : ''}

          ${this._extraResultHTML(method.id, scores)}

          ${student ? `
            <div style="background:var(--green-l);border-radius:var(--r-lg);padding:12px 16px;margin-bottom:20px;font-size:13.5px;color:var(--green)">
              ✓ Сохранено в карточку: <b>${escHtml(student.first_name)} ${escHtml(student.last_name||'')}</b>
            </div>` : ''}

          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" id="res-close">Закрыть</button>
          </div>
        </div>
      </div>`;

    el.querySelector('#res-close').addEventListener('click', () => this.close());
  },

  _extraResultHTML(methodId, scores) {
    if (!scores) return '';

    // Люшер: визуальный ряд цветов
    if (methodId === 'luscher' && scores.avgPos) {
      const sorted = LUSCHER_COLORS.slice().sort((a,b) => scores.avgPos[a.id] - scores.avgPos[b.id]);
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:10px;text-transform:uppercase">
            Средний порядок предпочтений
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            ${sorted.map((c,i) => `
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="font-size:11px;font-weight:700;color:var(--text-3)">${i+1}</div>
                <div style="width:40px;height:40px;border-radius:var(--r-md);background:${c.hex};box-shadow:var(--shadow-sm)"></div>
                <div style="font-size:10px;color:var(--text-3);text-align:center;max-width:44px">${c.name}</div>
              </div>`).join('')}
          </div>
        </div>`;
    }

    // Лурия: мини-график
    if (methodId === 'luria10' && scores.immediate) {
      const all = [...scores.immediate, ...(scores.delayed !== null ? [scores.delayed] : [])];
      const maxVal = 10;
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:12px;text-transform:uppercase">Кривая памяти</div>
          <div style="display:flex;align-items:flex-end;gap:8px;height:80px;padding-bottom:20px;position:relative">
            ${all.map((v,i) => {
              const h   = Math.round((v/maxVal)*70);
              const isDelay = i === 5;
              const col = isDelay ? 'var(--amber)' : 'var(--indigo)';
              return `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                  <div style="font-size:10px;font-weight:700;color:${col}">${v}</div>
                  <div style="width:100%;height:${h}px;background:${col};border-radius:3px 3px 0 0;opacity:.8"></div>
                  <div style="font-size:10px;color:var(--text-3);position:absolute;bottom:0">${isDelay?'Отср.':i+1}</div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    return '';
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  ПОЛЬЗОВАТЕЛЬСКИЕ МЕТОДИКИ (редактор)
  // ════════════════════════════════════════════════════════════════════════════
  _runCustom(diag, questions, student) {
    const sName = student ? `${student.first_name} ${student.last_name||''}` : null;
    const el = this._makeOverlay(diag.name, sName);
    const answers = {}, notes = {};
    let idx = 0;

    const renderQ = () => {
      if (idx >= questions.length) { finishCustom(); return; }
      const q   = questions[idx];
      const pct = Math.round(idx / questions.length * 100);
      const isTeacher = diag.fill_by === 'teacher';

      if (isTeacher) {
        // Показываем все сразу
        renderAllCustom();
        return;
      }

      // По одному
      document.getElementById('dp-body').innerHTML = `
        <div style="width:100%;max-width:620px">
          <div style="background:var(--surface-2);border-radius:4px;height:6px;margin-bottom:24px;overflow:hidden">
            <div style="height:100%;background:var(--indigo);width:${pct}%;transition:width .3s"></div>
          </div>
          <div class="player-card" style="padding:28px">
            <div style="font-size:12px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:10px">
              Вопрос ${idx+1} из ${questions.length}
            </div>
            <div style="font-size:16px;font-weight:500;color:var(--text-1);margin-bottom:24px;line-height:1.55">${escHtml(q.text)}</div>
            <div id="dp-custom-answer"></div>
          </div>
        </div>`;
      renderCustomAnswer(q, document.getElementById('dp-custom-answer'), answers, notes, () => { idx++; renderQ(); });
    };

    const renderAllCustom = () => {
      document.getElementById('dp-topbar-right').innerHTML =
        `<button class="btn btn-primary" id="dp-custom-finish">Завершить</button>`;
      document.getElementById('dp-body').innerHTML = `
        <div style="width:100%;max-width:680px;display:flex;flex-direction:column;gap:16px" id="dp-all-qs"></div>`;

      const container = document.getElementById('dp-all-qs');
      questions.forEach((q, qi) => {
        const div = document.createElement('div');
        div.className = 'player-card';
        div.style.cssText = 'padding:22px;animation:none';
        div.innerHTML = `
          <div style="font-size:11.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:8px">
            ${qi+1} / ${questions.length}
          </div>
          <div style="font-size:14.5px;font-weight:500;margin-bottom:16px;line-height:1.5">${escHtml(q.text)}</div>
          <div class="dp-custom-a" data-qi="${qi}"></div>`;
        container.appendChild(div);
        renderCustomAnswer(q, div.querySelector('.dp-custom-a'), answers, notes, null);
      });
      document.getElementById('dp-custom-finish')?.addEventListener('click', finishCustom);
    };

    const finishCustom = async () => {
      const summary = `${Object.keys(answers).length + Object.values(notes).filter(v=>v?.trim()).length} ответов`;
      await window.db.diagnostics.saveResult({
        diagnostic_id: diag.id,
        student_id:    student?.id || null,
        answers:       { answers, notes },
        scores:        {},
        summary,
      });
      this._showSimpleFinal(diag.name, summary, student);
    };

    renderQ();
  },

  _showSimpleFinal(name, summary, student) {
    const el = this._el;
    el.innerHTML = `
      <div class="player-topbar"></div>
      <div class="player-body">
        <div class="player-card" style="max-width:480px;text-align:center">
          <div style="font-size:44px;margin-bottom:12px">📋</div>
          <div style="font-family:var(--font-title);font-size:20px;font-weight:600;margin-bottom:6px">Готово</div>
          <div style="font-size:14px;color:var(--text-2);margin-bottom:20px">${escHtml(name)}</div>
          <div style="font-size:13.5px;color:var(--text-3);margin-bottom:20px">${escHtml(summary)}</div>
          ${student ? `<div style="background:var(--green-l);border-radius:var(--r-lg);padding:10px 14px;margin-bottom:20px;font-size:13px;color:var(--green)">
            ✓ Сохранено: <b>${escHtml(student.first_name)} ${escHtml(student.last_name||'')}</b></div>` : ''}
          <button class="btn btn-ghost" id="sf-close">Закрыть</button>
        </div>
      </div>`;
    el.querySelector('#sf-close').addEventListener('click', () => this.close());
  },
};

// ── Ответ пользовательского вопроса ──────────────────────────────────────────
function renderCustomAnswer(q, container, answers, notes, onNext) {
  if (!container) return;
  const isTeacher = true; // already handled above

  if (q.type === 'text') {
    container.innerHTML = `<textarea class="input-field" placeholder="Наблюдение..." style="height:80px;width:100%">${escHtml(notes[q.id]||'')}</textarea>
      ${onNext ? '<div style="margin-top:10px;text-align:right"><button class="btn btn-primary dp-next">Далее</button></div>' : ''}`;
    container.querySelector('textarea').addEventListener('input', e => { notes[q.id] = e.target.value; });
    container.querySelector('.dp-next')?.addEventListener('click', () => { notes[q.id] = container.querySelector('textarea').value; onNext(); });
    return;
  }

  const opts = q.options || [];
  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${opts.map((o,i) => `<button class="player-opt dp-copt" data-i="${i}"
        style="font-size:13.5px;padding:10px 16px">${escHtml(o)}</button>`).join('')}
    </div>
    ${onNext && q.type === 'choice' ? '<div style="margin-top:10px;text-align:right"><button class="btn btn-primary dp-next" disabled>Далее</button></div>' : ''}`;

  container.querySelectorAll('.dp-copt').forEach(btn => {
    // Preselect if already answered
    if (answers[q.id]?.index === +btn.dataset.i) btn.classList.add('correct');
    btn.addEventListener('click', () => {
      container.querySelectorAll('.dp-copt').forEach(b => b.classList.remove('correct'));
      btn.classList.add('correct');
      answers[q.id] = { index: +btn.dataset.i, label: opts[+btn.dataset.i] };
      const nextBtn = container.querySelector('.dp-next');
      if (nextBtn) nextBtn.disabled = false;
      if (onNext && !container.querySelector('.dp-next')) setTimeout(onNext, 400);
    });
  });
  container.querySelector('.dp-next')?.addEventListener('click', () => { if (answers[q.id]) onNext(); });
}

// ══════════════════════════════════════════════════════════════════════════════
//  UI-РЕНДЕРЫ ДЛЯ ВСТРОЕННЫХ МЕТОДИК
// ══════════════════════════════════════════════════════════════════════════════
const DiagUIs = {

  // ── 1. Тест Люшера ────────────────────────────────────────────────────────
  luscher(el, onDone) {
    const body    = document.getElementById('dp-body');
    const topbar  = document.getElementById('dp-topbar-right');
    let round     = 1; // 1 или 2
    let row1      = [], row2 = [];
    let remaining = LUSCHER_COLORS.map(c => c.id);

    const render = () => {
      topbar.innerHTML = `<span style="font-size:13px;color:var(--text-3)">Выбор ${round} из 2</span>`;
      body.innerHTML = `
        <div style="max-width:600px;width:100%">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px">
            <div style="font-family:var(--font-title);font-size:18px;font-weight:600;text-align:center;margin-bottom:8px">
              ${round === 1 ? 'Первый выбор' : 'Второй выбор'}
            </div>
            <div style="font-size:13.5px;color:var(--text-3);text-align:center;margin-bottom:24px;line-height:1.6">
              ${round === 1
                ? 'Выбирайте цвета в порядке предпочтения — от самого приятного к наименее приятному. Нажимайте по одному.'
                : 'Отложите первый выбор. Снова выберите цвета от самого приятного.'}
            </div>

            <!-- Выбранные -->
            <div style="margin-bottom:16px;min-height:52px">
              <div style="font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:8px;text-transform:uppercase">Ваш выбор (${round===1?row1.length:row2.length}/8):</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap" id="luscher-chosen">
                ${(round===1?row1:row2).map((cid,i) => {
                  const c = LUSCHER_COLORS[cid];
                  return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer" class="lc-undo" data-cid="${cid}" title="Убрать">
                    <div style="font-size:10px;font-weight:700;color:var(--text-3)">${i+1}</div>
                    <div style="width:38px;height:38px;border-radius:8px;background:${c.hex};border:2px solid rgba(0,0,0,.1);position:relative">
                      <div style="position:absolute;inset:0;background:rgba(0,0,0,.4);border-radius:6px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s" class="lu-hint">✕</div>
                    </div>
                  </div>`;
                }).join('') || '<span style="color:var(--text-3);font-size:13px">Нажмите на цвет ниже</span>'}
              </div>
            </div>

            <!-- Доступные -->
            <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px 0">
              ${remaining.map(cid => {
                const c = LUSCHER_COLORS[cid];
                return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer" class="lc-pick" data-cid="${cid}">
                  <div style="width:64px;height:64px;border-radius:12px;background:${c.hex};border:3px solid rgba(0,0,0,.1);transition:transform .15s,box-shadow .15s;box-shadow:var(--shadow-sm)" class="lc-swatch"></div>
                  <div style="font-size:11px;color:var(--text-3);font-weight:500">${c.name}</div>
                </div>`;
              }).join('')}
            </div>

            ${(round===1?row1:row2).length === 8 ? `
              <div style="text-align:center;margin-top:16px">
                <button class="btn btn-primary" id="luscher-next" style="font-size:15px;padding:12px 32px">
                  ${round === 1 ? 'Продолжить →' : 'Завершить →'}
                </button>
              </div>` : ''}
          </div>
        </div>`;

      // Hover
      body.querySelectorAll('.lc-pick').forEach(pick => {
        pick.addEventListener('mouseenter', () => pick.querySelector('.lc-swatch').style.transform = 'scale(1.08)');
        pick.addEventListener('mouseleave', () => pick.querySelector('.lc-swatch').style.transform = '');
        pick.addEventListener('click', () => {
          const cid = +pick.dataset.cid;
          if (round === 1) row1.push(cid);
          else             row2.push(cid);
          remaining = remaining.filter(id => id !== cid);
          render();
        });
      });

      // Undo
      body.querySelectorAll('.lc-undo').forEach(el => {
        el.addEventListener('mouseenter', () => el.querySelector('.lu-hint').style.opacity = '1');
        el.addEventListener('mouseleave', () => el.querySelector('.lu-hint').style.opacity = '0');
        el.addEventListener('click', () => {
          const cid = +el.dataset.cid;
          if (round === 1) { row1 = row1.filter(id => id !== cid); }
          else             { row2 = row2.filter(id => id !== cid); }
          remaining = [...remaining, cid].sort((a,b)=>a-b);
          render();
        });
      });

      body.querySelector('#luscher-next')?.addEventListener('click', () => {
        if (round === 1) {
          round = 2;
          remaining = LUSCHER_COLORS.map(c => c.id);
          render();
        } else {
          onDone({ row1, row2 });
        }
      });
    };
    render();
  },

  // ── 2. Лурия «10 слов» ───────────────────────────────────────────────────
  luria10(el, onDone) {
    const body    = document.getElementById('dp-body');
    const topbar  = document.getElementById('dp-topbar-right');
    const attempts = Array(6).fill(null);
    const WORDS = ['Лес','Хлеб','Окно','Стул','Вода','Брат','Конь','Гриб','Игла','Мёд'];

    const render = () => {
      const filled = attempts.filter(v => v !== null).length;
      topbar.innerHTML = `<span style="font-size:13px;color:var(--text-3)">Попыток записано: ${filled}/6</span>`;

      body.innerHTML = `
        <div style="max-width:660px;width:100%">
          <!-- Стимульный материал -->
          <div style="background:var(--indigo-l);border:1px solid var(--indigo-m);border-radius:var(--r-xl);padding:20px;margin-bottom:20px">
            <div style="font-size:12px;font-weight:700;color:var(--indigo);margin-bottom:10px;text-transform:uppercase">Слова для запоминания</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${WORDS.map(w => `<span style="padding:5px 12px;background:rgba(255,255,255,.7);border-radius:20px;font-size:14px;font-weight:600;color:var(--indigo)">${w}</span>`).join('')}
            </div>
          </div>

          <!-- Таблица попыток -->
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;margin-bottom:16px">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:var(--surface-2)">
                  <th style="padding:12px 16px;font-size:11.5px;font-weight:700;color:var(--text-3);text-align:left;border-bottom:1px solid var(--border)">Попытка</th>
                  <th style="padding:12px 16px;font-size:11.5px;font-weight:700;color:var(--text-3);text-align:left;border-bottom:1px solid var(--border)">Слов воспроизведено</th>
                  <th style="padding:12px 16px;font-size:11.5px;font-weight:700;color:var(--text-3);text-align:left;border-bottom:1px solid var(--border)">График</th>
                </tr>
              </thead>
              <tbody>
                ${attempts.map((v, i) => {
                  const label = i < 5 ? `${i+1}-е повторение` : 'Отсроченное';
                  const barW  = v !== null ? Math.round(v/10*100) : 0;
                  const barColor = i < 5 ? 'var(--indigo)' : 'var(--amber)';
                  return `
                    <tr style="border-bottom:1px solid var(--border)">
                      <td style="padding:12px 16px;font-size:13.5px;font-weight:500;color:${i===5?'var(--amber)':'var(--text-1)'}">
                        ${label}${i===5?' (через 30–60 мин)':''}
                      </td>
                      <td style="padding:12px 16px">
                        <input type="number" min="0" max="10" value="${v ?? ''}"
                          class="input-field luria-input" data-i="${i}"
                          placeholder="0–10"
                          style="width:80px;padding:6px 10px;font-size:14px;font-weight:600;text-align:center">
                      </td>
                      <td style="padding:12px 16px">
                        <div style="height:18px;background:var(--surface-2);border-radius:3px;width:120px;overflow:hidden">
                          <div style="height:100%;width:${barW}%;background:${barColor};border-radius:3px;transition:width .3s"></div>
                        </div>
                        ${v !== null ? `<span style="font-size:11px;color:var(--text-3);margin-left:6px">${v}/10</span>` : ''}
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>

          ${filled >= 5 ? `
            <div style="text-align:right">
              <button class="btn btn-primary" id="luria-done" style="font-size:14px;padding:11px 28px">
                Рассчитать результат →
              </button>
            </div>` : `
            <div style="font-size:13px;color:var(--text-3);text-align:center">
              Заполните минимум 5 попыток (6-я — отсроченная, необязательна)
            </div>`}
        </div>`;

      body.querySelectorAll('.luria-input').forEach(inp => {
        inp.addEventListener('change', () => {
          const val = Math.min(10, Math.max(0, parseInt(inp.value) || 0));
          inp.value = val;
          attempts[+inp.dataset.i] = val;
          render();
        });
      });

      body.querySelector('#luria-done')?.addEventListener('click', () => {
        onDone({ attempts: attempts.map(v => v ?? 0) });
      });
    };
    render();
  },

  // ── 3. Четвёртый лишний ──────────────────────────────────────────────────
  fourthOdd(el, onDone) {
    const body   = document.getElementById('dp-body');
    const topbar = document.getElementById('dp-topbar-right');

    // Стандартный набор карточек Четвёртого лишнего
    const CARDS = [
      { items: ['Кошка','Собака','Лошадь','Щука'],      answer: 3, hint: 'Щука — рыба' },
      { items: ['Стол','Стул','Диван','Молоток'],        answer: 3, hint: 'Молоток — инструмент' },
      { items: ['Берёза','Дуб','Роза','Сосна'],          answer: 2, hint: 'Роза — цветок' },
      { items: ['Самолёт','Автобус','Корабль','Лыжи'],   answer: 3, hint: 'Лыжи — не транспорт' },
      { items: ['Круг','Треугольник','Квадрат','Яблоко'],answer: 3, hint: 'Яблоко — не фигура' },
      { items: ['Молоко','Сметана','Сыр','Мясо'],        answer: 3, hint: 'Мясо — не молочный' },
      { items: ['Молоток','Топор','Пила','Гвоздь'],      answer: 3, hint: 'Гвоздь — не инструмент' },
      { items: ['Апельсин','Лимон','Помидор','Мандарин'],answer: 2, hint: 'Помидор — овощ' },
    ];

    const results = Array(CARDS.length).fill(null).map(() => ({ chosen: null, score: null, explanation: '' }));

    const render = () => {
      const done = results.filter(r => r.score !== null).length;
      topbar.innerHTML = `<span style="font-size:13px;color:var(--text-3)">Заданий: ${done}/${CARDS.length}</span>`;

      body.innerHTML = `
        <div style="max-width:720px;width:100%;display:flex;flex-direction:column;gap:14px" id="fo-list"></div>`;

      const container = document.getElementById('fo-list');

      CARDS.forEach((card, ci) => {
        const r    = results[ci];
        const div  = document.createElement('div');
        div.className = 'player-card';
        div.style.cssText = 'padding:20px;animation:none';
        div.innerHTML = `
          <div style="font-size:12px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:10px">Карточка ${ci+1}</div>
          <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
            ${card.items.map((item,ii) => `
              <div class="fo-item ${r.chosen===ii?'selected':''}" data-ci="${ci}" data-ii="${ii}"
                style="padding:10px 20px;border:2px solid ${r.chosen===ii?'var(--indigo)':'var(--border)'};
                       border-radius:var(--r-md);cursor:pointer;font-size:14px;font-weight:500;
                       background:${r.chosen===ii?'var(--indigo-l)':'var(--surface)'};
                       color:${r.chosen===ii?'var(--indigo)':'var(--text-1)'};transition:all .15s">
                ${escHtml(item)}
              </div>`).join('')}
          </div>

          ${r.chosen !== null ? `
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div style="font-size:12.5px;font-weight:600;color:var(--text-2)">Оценка объяснения:</div>
              ${[0,1,2].map(sc => `
                <button class="fo-score ${r.score===sc?'active':''}" data-ci="${ci}" data-sc="${sc}"
                  style="padding:6px 14px;border-radius:var(--r-md);border:2px solid ${r.score===sc?'var(--indigo)':'var(--border)'};
                         background:${r.score===sc?'var(--indigo)':'var(--surface)'};
                         color:${r.score===sc?'#fff':'var(--text-2)'};font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s">
                  ${sc} — ${['Нет/случайный','Функциональный','Категориальный'][sc]}
                </button>`).join('')}
              <input class="input-field fo-exp" data-ci="${ci}" placeholder="Объяснение ребёнка..."
                value="${escHtml(r.explanation)}"
                style="flex:1;min-width:180px;font-size:13px;padding:6px 10px">
            </div>` : `
            <div style="font-size:12.5px;color:var(--text-3)">Выберите лишний элемент ↑</div>`}`;

        container.appendChild(div);
      });

      // Выбор элемента
      container.querySelectorAll('.fo-item').forEach(btn => {
        btn.addEventListener('click', () => {
          results[+btn.dataset.ci].chosen = +btn.dataset.ii;
          render();
        });
      });

      // Оценка
      container.querySelectorAll('.fo-score').forEach(btn => {
        btn.addEventListener('click', () => {
          results[+btn.dataset.ci].score = +btn.dataset.sc;
          render();
        });
      });

      // Объяснение
      container.querySelectorAll('.fo-exp').forEach(inp => {
        inp.addEventListener('input', () => { results[+inp.dataset.ci].explanation = inp.value; });
      });

      if (done >= CARDS.length * 0.75) {
        const doneBtn = document.createElement('div');
        doneBtn.style.cssText = 'text-align:right;margin-top:8px';
        doneBtn.innerHTML = `<button class="btn btn-primary" id="fo-done" style="font-size:14px;padding:11px 28px">Рассчитать →</button>`;
        container.appendChild(doneBtn);
        document.getElementById('fo-done').addEventListener('click', () => {
          const valid = results.filter(r => r.score !== null);
          if (!valid.length) { toast('Оцените хотя бы одно задание', 'error'); return; }
          onDone({ items: valid.map((r,i) => ({ ...r, card: i })) });
        });
      }
    };
    render();
  },

  // ── 4. Пьерон–Рузер ──────────────────────────────────────────────────────
  pierronRoser(el, onDone) {
    const body   = document.getElementById('dp-body');
    let total = '', errors = '', time_min = 1;

    const render = () => {
      body.innerHTML = `
        <div style="max-width:560px;width:100%">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px">
            <div style="font-family:var(--font-title);font-size:18px;font-weight:600;margin-bottom:6px">Проба Пьерона–Рузера</div>
            <div style="font-size:13.5px;color:var(--text-3);margin-bottom:24px;line-height:1.6">
              Подсчитайте результаты после выполнения ребёнком задания с фигурами.
            </div>

            <div style="display:flex;flex-direction:column;gap:16px">
              <div class="form-group">
                <label class="form-label">Время выполнения</label>
                <div style="display:flex;gap:10px">
                  ${[1,3].map(t => `
                    <button class="pr-time ${time_min===t?'active':''}" data-t="${t}"
                      style="flex:1;padding:10px;border-radius:var(--r-md);border:2px solid ${time_min===t?'var(--indigo)':'var(--border)'};
                             background:${time_min===t?'var(--indigo-l)':'var(--surface)'};color:${time_min===t?'var(--indigo)':'var(--text-2)'};
                             font-family:var(--font-ui);font-size:13.5px;font-weight:600;cursor:pointer">
                      ${t} минута${t===3?'ы':''}
                    </button>`).join('')}
                </div>
              </div>

              <div class="form-row form-row-2">
                <div class="form-group">
                  <label class="form-label">Всего фигур обработано</label>
                  <input class="input-field" id="pr-total" type="number" min="0" max="300"
                    value="${total}" placeholder="например: 24" style="font-size:16px;font-weight:600;text-align:center">
                </div>
                <div class="form-group">
                  <label class="form-label">Ошибок (пропуски + неверные)</label>
                  <input class="input-field" id="pr-errors" type="number" min="0" max="100"
                    value="${errors}" placeholder="например: 2" style="font-size:16px;font-weight:600;text-align:center">
                </div>
              </div>

              ${total !== '' && errors !== '' ? `
                <div style="background:var(--indigo-l);border-radius:var(--r-md);padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;color:var(--indigo);margin-bottom:6px">Предварительный расчёт</div>
                  <div style="font-size:13.5px;color:var(--indigo)">
                    Точность: ${total>0?Math.round(Math.max(0,total-errors)/total*100):0}%<br>
                    Темп: ${(total/time_min).toFixed(1)} фигур/мин
                  </div>
                </div>` : ''}

              <button class="btn btn-primary" id="pr-calc" ${total===''||errors===''?'disabled':''} style="font-size:14px;padding:12px">
                Рассчитать результат →
              </button>
            </div>
          </div>
        </div>`;

      body.querySelectorAll('.pr-time').forEach(btn => {
        btn.addEventListener('click', () => { time_min = +btn.dataset.t; render(); });
      });
      body.querySelector('#pr-total').addEventListener('input', e => { total = e.target.value; render(); });
      body.querySelector('#pr-errors').addEventListener('input', e => { errors = e.target.value; render(); });
      body.querySelector('#pr-calc')?.addEventListener('click', () => {
        onDone({ total: parseInt(total)||0, errors: parseInt(errors)||0, time_min });
      });
    };
    render();
  },

  // ── 5. Лесенка ───────────────────────────────────────────────────────────
  ladder(el, onDone) {
    const body = document.getElementById('dp-body');
    let selfPos = null, momPos = null, age = '';
    const STEPS = 7;
    const TOP = 'Самый хороший', BOT = 'Самый плохой';

    const render = () => {
      const makeLadder = (selectedStep, label, onSelect) => {
        const maxH = 110, minH = 18;
        return `
          <div style="text-align:center;margin-bottom:8px;font-size:12.5px;font-weight:700;color:var(--green)">${TOP}</div>
          <div style="display:flex;align-items:flex-end;justify-content:center;gap:4px;margin-bottom:4px">
            ${Array.from({length:STEPS},(_,i) => {
              const step  = STEPS - i;
              const h     = Math.round(minH + (step-1)/(STEPS-1)*(maxH-minH));
              const isSel = selectedStep === step;
              return `
                <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" class="${label}-step" data-step="${step}">
                  <div style="font-size:10.5px;font-weight:700;color:${isSel?'var(--indigo)':'transparent'};margin-bottom:2px">${isSel?'◀':''}</div>
                  <div style="width:46px;height:${h}px;border-radius:4px 4px 0 0;
                    background:${isSel?'var(--indigo)':'var(--indigo-m)'};
                    border:2px solid ${isSel?'var(--indigo)':'transparent'};
                    transition:all .2s;
                    display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px">
                    ${isSel ? `<span style="font-size:12px;font-weight:700;color:#fff">${step}</span>` : ''}
                  </div>
                  <div style="font-size:11px;font-weight:500;color:${isSel?'var(--indigo)':'var(--text-3)'};margin-top:4px">${step}</div>
                </div>`;
            }).join('')}
          </div>
          <div style="text-align:center;font-size:12.5px;font-weight:700;color:var(--rose)">${BOT}</div>`;
      };

      body.innerHTML = `
        <div style="max-width:640px;width:100%">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">

            <!-- Ступенька ребёнка -->
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:22px">
              <div style="font-size:13px;font-weight:700;color:var(--text-1);margin-bottom:4px">Куда ставит себя ребёнок?</div>
              <div style="font-size:12px;color:var(--text-3);margin-bottom:16px">«На какой ступеньке ты стоишь?»</div>
              ${makeLadder(selfPos, 'self', null)}
              ${selfPos ? `<div style="text-align:center;margin-top:10px;font-size:13px;font-weight:600;color:var(--indigo)">Выбрана ступенька ${selfPos}</div>` : ''}
            </div>

            <!-- Ступенька мамы -->
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:22px">
              <div style="font-size:13px;font-weight:700;color:var(--text-1);margin-bottom:4px">Куда мама поставит ребёнка?</div>
              <div style="font-size:12px;color:var(--text-3);margin-bottom:16px">«На какую ступеньку тебя поставит мама?»</div>
              ${makeLadder(momPos, 'mom', null)}
              ${momPos ? `<div style="text-align:center;margin-top:10px;font-size:13px;font-weight:600;color:var(--indigo)">Выбрана ступенька ${momPos}</div>` : ''}
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:18px;margin-bottom:16px">
            <div class="form-group">
              <label class="form-label">Возраст ребёнка (лет)</label>
              <input class="input-field" id="ladder-age" type="number" min="3" max="18"
                value="${age}" placeholder="например: 7" style="max-width:120px">
            </div>
          </div>

          <div style="text-align:right">
            <button class="btn btn-primary" id="ladder-done" ${!selfPos?'disabled':''} style="font-size:14px;padding:11px 28px">
              Рассчитать →
            </button>
          </div>
        </div>`;

      body.querySelectorAll('.self-step').forEach(step => {
        step.addEventListener('click', () => { selfPos = +step.dataset.step; render(); });
      });
      body.querySelectorAll('.mom-step').forEach(step => {
        step.addEventListener('click', () => { momPos = +step.dataset.step; render(); });
      });
      body.querySelector('#ladder-age').addEventListener('input', e => { age = e.target.value; });
      body.querySelector('#ladder-done')?.addEventListener('click', () => {
        onDone({ selfPos, momPos: momPos || null, age: parseInt(age)||null });
      });
    };
    render();
  },

  // ── 6. Керн–Йерасек ──────────────────────────────────────────────────────
  kernYerasek(el, onDone) {
    const body = document.getElementById('dp-body');
    let sub1 = null, sub2 = null, sub3 = null;

    const CRITERIA = [
      {
        name: 'Субтест 1: Рисунок человека',
        scores: [
          { v:1, label:'1 — Отлично', desc:'Голова, туловище, конечности. Детали лица. Волосы, пальцы.' },
          { v:2, label:'2 — Хорошо',  desc:'Голова, туловище, конечности. Без пальцев. Шея допустима.' },
          { v:3, label:'3 — Норма',   desc:'Голова, туловище, конечности. Могут быть ошибки.' },
          { v:4, label:'4 — Плохо',   desc:'Примитивный рисунок с признаками конечностей.' },
          { v:5, label:'5 — Очень плохо', desc:'Каракули, нечёткое изображение человека.' },
        ],
        key: 'sub1',
      },
      {
        name: 'Субтест 2: Копирование фраз',
        scores: [
          { v:1, label:'1 — Отлично',    desc:'Хорошо читаемая копия. Буквы не более 2× крупнее.' },
          { v:2, label:'2 — Хорошо',     desc:'Читаемо. Размер и наклон соблюдены.' },
          { v:3, label:'3 — Норма',       desc:'Разбита на 2+ части. Можно разобрать 4+ буквы.' },
          { v:4, label:'4 — Плохо',       desc:'«Написано» 2+ буквы. Подражает письму.' },
          { v:5, label:'5 — Очень плохо', desc:'Каракули.' },
        ],
        key: 'sub2',
      },
      {
        name: 'Субтест 3: Срисовывание точек',
        scores: [
          { v:1, label:'1 — Отлично',    desc:'Точное копирование. Небольшие отклонения.' },
          { v:2, label:'2 — Хорошо',     desc:'≤2 точки вне образца. Фигура распознаётся.' },
          { v:3, label:'3 — Норма',       desc:'Общее сходство. Отдельные точки выходят за контур.' },
          { v:4, label:'4 — Плохо',       desc:'Контур не похож. Есть 10 точек.' },
          { v:5, label:'5 — Очень плохо', desc:'Каракули.' },
        ],
        key: 'sub3',
      },
    ];

    const state = { sub1, sub2, sub3 };

    const render = () => {
      const done = [state.sub1, state.sub2, state.sub3].filter(v => v !== null).length;
      const total = (state.sub1||0) + (state.sub2||0) + (state.sub3||0);

      body.innerHTML = `
        <div style="max-width:680px;width:100%;display:flex;flex-direction:column;gap:16px">
          ${CRITERIA.map(cr => `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:22px">
              <div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:14px">${cr.name}</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${cr.scores.map(s => {
                  const sel = state[cr.key] === s.v;
                  return `
                    <div class="kj-opt" data-key="${cr.key}" data-v="${s.v}"
                      style="display:flex;gap:12px;padding:12px 14px;border-radius:var(--r-md);cursor:pointer;
                             border:2px solid ${sel?'var(--indigo)':'var(--border)'};
                             background:${sel?'var(--indigo-l)':'var(--surface)'};transition:all .15s">
                      <div style="width:24px;height:24px;border-radius:50%;border:2px solid ${sel?'var(--indigo)':'var(--border-2)'};
                                  background:${sel?'var(--indigo)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
                        ${sel ? '<span style="color:#fff;font-size:12px">✓</span>' : ''}
                      </div>
                      <div>
                        <div style="font-size:13.5px;font-weight:600;color:${sel?'var(--indigo)':'var(--text-1)'};margin-bottom:3px">${s.label}</div>
                        <div style="font-size:12.5px;color:var(--text-3);line-height:1.5">${s.desc}</div>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>`).join('')}

          ${done === 3 ? `
            <div style="background:var(--indigo-l);border:1px solid var(--indigo-m);border-radius:var(--r-lg);padding:16px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--indigo);text-transform:uppercase;margin-bottom:4px">Итоговая сумма</div>
                <div style="font-size:24px;font-weight:700;color:var(--indigo)">${total} / 15</div>
                <div style="font-size:13px;color:var(--indigo);opacity:.8">
                  ${total<=5?'Готов к школе':total<=9?'Зрелость в норме':'Функциональная незрелость'}
                </div>
              </div>
              <button class="btn btn-primary" id="kj-done" style="font-size:14px;padding:12px 24px">Рассчитать →</button>
            </div>` : `
            <div style="font-size:13px;color:var(--text-3);text-align:center">Оцените все 3 субтеста</div>`}
        </div>`;

      body.querySelectorAll('.kj-opt').forEach(opt => {
        opt.addEventListener('click', () => { state[opt.dataset.key] = +opt.dataset.v; render(); });
      });

      body.querySelector('#kj-done')?.addEventListener('click', () => {
        onDone({ sub1: state.sub1, sub2: state.sub2, sub3: state.sub3 });
      });
    };
    render();
  },
};

// ── Публичные точки входа (вызываются из diagnostics.js) ──────────────────────
DiagPlayer.startBuiltin = async function(methodId, studentId) {
  const method  = getDiagMethod(methodId);
  if (!method) { toast('Методика не найдена', 'error'); return; }
  const student = studentId ? await window.db.students.get(studentId) : null;

  // Создаём временную запись диагностики для сохранения результата
  const diagRecord = { id: null, name: method.name, method_id: methodId, fill_by: method.fill_by };
  DiagPlayer._runBuiltin(diagRecord, method, student);
};

DiagPlayer.startCustom = async function(diagId, studentId) {
  const d = await window.db.diagnostics.get(diagId);
  if (!d) { toast('Опросник не найден', 'error'); return; }
  let questions = [];
  try { questions = JSON.parse(d.questions || '[]'); } catch(e) {}
  if (!questions.length) { toast('Нет вопросов — откройте редактор', 'error'); return; }
  const student = studentId ? await window.db.students.get(studentId) : null;
  DiagPlayer._runCustom(d, questions, student);
};
