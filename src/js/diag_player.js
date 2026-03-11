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

    // Филлипс: разбивка по факторам
    if (methodId === 'phillips' && scores.factors) {
      const fColors = { general:'var(--indigo)', school:'var(--rose)', evaluation:'var(--amber)', teacher:'var(--green)' };
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:12px;text-transform:uppercase">По шкалам</div>
          ${Object.entries(scores.factors).filter(([k]) => k !== 'general').map(([k, f]) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12.5px;color:var(--text-2)">${f.name}</span>
                <span style="font-size:12.5px;font-weight:700;color:${fColors[k]||'var(--indigo)'}">${f.pct}%</span>
              </div>
              <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${f.pct}%;background:${fColors[k]||'var(--indigo)'};border-radius:4px;transition:width .5s"></div>
              </div>
            </div>`).join('')}
        </div>`;
    }

    // Социометрия: таблица статусов
    if (methodId === 'sociometry' && scores.pupils) {
      const statusLabel = { star:'⭐ Звезда', preferred:'👍 Предпочитаемый', average:'😐 Принятый', rejected:'👻 Изолированный' };
      const statusColor = { star:'var(--amber)', preferred:'var(--green)', average:'var(--text-2)', rejected:'var(--rose)' };
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:12px;text-transform:uppercase">Статусы учеников</div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto">
            ${scores.pupils.map((p, i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--surface-2);border-radius:var(--r-md)">
                <div style="flex:1;font-size:13px;font-weight:500;color:var(--text-1)">${escHtml(p)}</div>
                <div style="font-size:12px;color:${statusColor[scores.statuses[i]]};font-weight:600">${statusLabel[scores.statuses[i]]}</div>
                <div style="font-size:12px;color:var(--text-3);min-width:70px;text-align:right">
                  получил: <b>${scores.received[i]}</b>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }

    // ВАШ: визуализация шкал
    if (methodId === 'vas' && scores.sliders) {
      const VAS_COLORS = { mood:'var(--indigo)', energy:'var(--green)', anxiety:'var(--rose)', interest:'var(--amber)', comfort:'var(--teal)' };
      const VAS_LABELS = { mood:'Настроение', energy:'Энергия', anxiety:'Тревога', interest:'Интерес', comfort:'Комфорт' };
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:12px;text-transform:uppercase">Профиль состояния</div>
          ${Object.entries(scores.sliders).map(([k, v]) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12.5px;color:var(--text-2)">${VAS_LABELS[k]||k}</span>
                <span style="font-size:13px;font-weight:700;color:${VAS_COLORS[k]||'var(--indigo)'}">${v}/10</span>
              </div>
              <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${v*10}%;background:${VAS_COLORS[k]||'var(--indigo)'};border-radius:4px"></div>
              </div>
            </div>`).join('')}
        </div>`;
    }

    return '';
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  ПОЛЬЗОВАТЕЛЬСКИЕ МЕТОДИКИ (редактор)
  // ════════════════════════════════════════════════════════════════════════════
  _runCustom(diag, elements, student) {
    // Поддержка нового формата (version:2) и старого (массив вопросов)
    const isV2 = !Array.isArray(elements) && elements.version === 2;
    if (isV2) {
      this._runCustomV2(diag, elements, student);
    } else {
      this._runCustomV1(diag, Array.isArray(elements) ? elements : [], student);
    }
  },

  // ── Новый формат v2 ──────────────────────────────────────────────────────
  _runCustomV2(diag, data, student) {
    const sName = student ? `${student.first_name} ${student.last_name||''}` : null;
    const el    = this._makeOverlay(diag.name, sName);
    const allEls = data.elements || [];

    // Разделяем: info-элементы просто показываем, остальные — ответы
    const answerable = allEls.filter(e => e.type !== 'info' && e.answer && e.answer.type !== null);
    const answers    = {}; // { elementId: { value, scoreIndex } }

    const isTeacher = diag.fill_by === 'teacher';

    if (isTeacher) {
      this._runV2AllAtOnce(diag, data, allEls, answerable, answers, student);
    } else {
      this._runV2Sequential(diag, data, allEls, answerable, answers, student);
    }
  },

  _runV2Sequential(diag, data, allEls, answerable, answers, student) {
    let idx = 0;

    const renderNext = () => {
      if (idx >= allEls.length) { finishV2(); return; }
      const elem = allEls[idx];

      // info — показываем как экран-разделитель
      if (elem.type === 'info') {
        document.getElementById('dp-body').innerHTML = `
          <div style="max-width:580px;width:100%">
            <div style="background:var(--indigo-l);border:1px solid var(--indigo-m);border-radius:var(--r-xl);padding:32px;text-align:center">
              <div style="font-size:15px;font-weight:500;color:var(--indigo);line-height:1.7;white-space:pre-wrap">${escHtml(elem.stimulus?.text||'')}</div>
              <button class="btn btn-primary" id="dp-info-next" style="margin-top:20px">Продолжить →</button>
            </div>
          </div>`;
        document.getElementById('dp-info-next').addEventListener('click', () => { idx++; renderNext(); });
        return;
      }

      const ansIdx  = answerable.indexOf(elem);
      const total   = answerable.length;
      const pct     = total ? Math.round(ansIdx / total * 100) : 100;
      const topbar  = document.getElementById('dp-topbar-right');
      topbar.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:12.5px;color:var(--text-3)">${ansIdx+1} / ${total}</span>
          <div style="width:80px;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--indigo);transition:width .3s"></div>
          </div>
        </div>`;

      document.getElementById('dp-body').innerHTML = `
        <div style="width:100%;max-width:640px">
          ${elem.stimulus?.image ? `<img data-path="${escHtml(elem.stimulus.image)}" class="lazy-img" style="width:100%;max-height:280px;object-fit:cover;border-radius:var(--r-xl);margin-bottom:20px">` : ''}
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px 32px">
            ${elem.stimulus?.text ? `<div style="font-size:16px;font-weight:500;color:var(--text-1);margin-bottom:22px;line-height:1.6">${escHtml(elem.stimulus.text)}</div>` : ''}
            <div id="dp-v2-ans"></div>
          </div>
        </div>`;

      renderV2Answer(elem, document.getElementById('dp-v2-ans'), answers, () => { idx++; renderNext(); });
    };

    const finishV2 = async () => {
      const { total, subscaleScores, summary } = calcV2Scores(data, answers);
      const saved = await window.db.diagnostics.saveResult({
        diagnostic_id: diag.id,
        student_id:    student?.id || null,
        answers:       answers,
        scores:        { total, subscaleScores },
        summary,
      });
      showV2Result(this._el, diag, data, total, subscaleScores, summary, student, () => this.close(), saved?.id);
    };

    renderNext();
  },

  _runV2AllAtOnce(diag, data, allEls, answerable, answers, student) {
    const topbar = document.getElementById('dp-topbar-right');
    topbar.innerHTML = `<button class="btn btn-primary" id="dp-v2-finish">Завершить</button>`;

    document.getElementById('dp-body').innerHTML = `
      <div style="width:100%;max-width:700px;display:flex;flex-direction:column;gap:14px" id="dp-v2-all"></div>`;

    const container = document.getElementById('dp-v2-all');
    let qi = 0;
    allEls.forEach(elem => {
      const div = document.createElement('div');

      if (elem.type === 'info') {
        div.style.cssText = 'background:var(--indigo-l);border:1px solid var(--indigo-m);border-radius:var(--r-xl);padding:18px 22px';
        div.innerHTML = `<div style="font-size:14px;color:var(--indigo);line-height:1.7;white-space:pre-wrap">${escHtml(elem.stimulus?.text||'')}</div>`;
      } else {
        qi++;
        div.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px 24px;animation:none';
        div.innerHTML = `
          <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:10px">№ ${qi}</div>
          ${elem.stimulus?.text ? `<div style="font-size:14px;font-weight:500;color:var(--text-1);margin-bottom:16px;line-height:1.5">${escHtml(elem.stimulus.text)}</div>` : ''}
          <div class="dp-v2-a-wrap"></div>`;
        renderV2Answer(elem, div.querySelector('.dp-v2-a-wrap'), answers, null);
      }
      container.appendChild(div);
    });

    document.getElementById('dp-v2-finish').addEventListener('click', async () => {
      const { total, subscaleScores, summary } = calcV2Scores(data, answers);
      const saved = await window.db.diagnostics.saveResult({
        diagnostic_id: diag.id,
        student_id:    student?.id || null,
        answers, scores: { total, subscaleScores }, summary,
      });
      showV2Result(this._el, diag, data, total, subscaleScores, summary, student, () => this.close(), saved?.id);
    });
  },

  // ── Старый формат v1 (обратная совместимость) ────────────────────────────
  _runCustomV1(diag, questions, student) {
    const sName = student ? `${student.first_name} ${student.last_name||''}` : null;
    const el = this._makeOverlay(diag.name, sName);
    const answers = {}, notes = {};
    let idx = 0;

    const renderQ = () => {
      if (idx >= questions.length) { finish(); return; }
      const q = questions[idx], pct = Math.round(idx / questions.length * 100);
      if (diag.fill_by === 'teacher') { renderAll(); return; }
      document.getElementById('dp-body').innerHTML = `
        <div style="width:100%;max-width:620px">
          <div style="background:var(--surface-2);border-radius:4px;height:6px;margin-bottom:24px;overflow:hidden">
            <div style="height:100%;background:var(--indigo);width:${pct}%;transition:width .3s"></div>
          </div>
          <div class="player-card" style="padding:28px">
            <div style="font-size:12px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:10px">
              Вопрос ${idx+1} из ${questions.length}
            </div>
            <div style="font-size:16px;font-weight:500;color:var(--text-1);margin-bottom:24px;line-height:1.55">${escHtml(q.text||'')}</div>
            <div id="dp-custom-answer"></div>
          </div>
        </div>`;
      renderCustomAnswer(q, document.getElementById('dp-custom-answer'), answers, notes, () => { idx++; renderQ(); });
    };

    const renderAll = () => {
      document.getElementById('dp-topbar-right').innerHTML = `<button class="btn btn-primary" id="dp-v1-fin">Завершить</button>`;
      document.getElementById('dp-body').innerHTML = `<div style="width:100%;max-width:680px;display:flex;flex-direction:column;gap:16px" id="dp-v1-all"></div>`;
      const container = document.getElementById('dp-v1-all');
      questions.forEach((q, qi) => {
        const div = document.createElement('div');
        div.className = 'player-card'; div.style.cssText = 'padding:22px;animation:none';
        div.innerHTML = `<div style="font-size:11.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:8px">${qi+1} / ${questions.length}</div>
          <div style="font-size:14.5px;font-weight:500;margin-bottom:16px;line-height:1.5">${escHtml(q.text||'')}</div>
          <div class="dp-v1-a" data-qi="${qi}"></div>`;
        container.appendChild(div);
        renderCustomAnswer(q, div.querySelector('.dp-v1-a'), answers, notes, null);
      });
      document.getElementById('dp-v1-fin')?.addEventListener('click', finish);
    };

    const finish = async () => {
      const cnt = Object.keys(answers).length + Object.values(notes).filter(v=>v?.trim()).length;
      const summary = `${cnt} ответов`;
      await window.db.diagnostics.saveResult({ diagnostic_id: diag.id, student_id: student?.id||null, answers: { answers, notes }, scores: {}, summary });
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

  // ── 7. Тест Филлипса (школьная тревожность) ──────────────────────────────
  phillips(el, onDone) {
    const body   = document.getElementById('dp-body');
    const topbar = document.getElementById('dp-topbar-right');
    const answers = Array(58).fill(null); // 1=Да, 0=Нет

    const render = (page) => {
      const PER_PAGE = 10;
      const totalPages = Math.ceil(PHILLIPS_QUESTIONS.length / PER_PAGE);
      const start = page * PER_PAGE;
      const pageQs = PHILLIPS_QUESTIONS.slice(start, start + PER_PAGE);
      const filled = answers.filter(a => a !== null).length;
      const pct    = Math.round(filled / 58 * 100);

      topbar.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:12.5px;color:var(--text-3)">Вопросов заполнено: ${filled}/58</div>
          <div style="width:120px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--indigo);transition:width .3s"></div>
          </div>
        </div>`;

      body.innerHTML = `
        <div style="max-width:680px;width:100%">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden">
            <div style="background:var(--indigo-l);padding:16px 20px;border-bottom:1px solid var(--border)">
              <div style="font-size:12px;font-weight:700;color:var(--indigo);text-transform:uppercase;margin-bottom:2px">Страница ${page+1} из ${totalPages}</div>
              <div style="font-size:13px;color:var(--text-2)">Отвечай честно: «Да» или «Нет»</div>
            </div>

            ${pageQs.map((q, li) => {
              const i   = start + li;
              const ans = answers[i];
              return `
                <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:center">
                  <div style="font-size:12px;font-weight:700;color:var(--text-3);width:24px;flex-shrink:0;text-align:right">${i+1}</div>
                  <div style="flex:1;font-size:13.5px;color:var(--text-1);line-height:1.5">${escHtml(q)}</div>
                  <div style="display:flex;gap:6px;flex-shrink:0">
                    <button class="phil-ans ${ans===1?'active':''}" data-i="${i}" data-v="1"
                      style="padding:7px 16px;border-radius:var(--r-md);border:2px solid ${ans===1?'var(--green)':'var(--border)'};
                             background:${ans===1?'var(--green-l)':'var(--surface)'};color:${ans===1?'var(--green)':'var(--text-2)'};
                             font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s">Да</button>
                    <button class="phil-ans ${ans===0?'active':''}" data-i="${i}" data-v="0"
                      style="padding:7px 16px;border-radius:var(--r-md);border:2px solid ${ans===0?'var(--rose)':'var(--border)'};
                             background:${ans===0?'var(--rose-l)':'var(--surface)'};color:${ans===0?'var(--rose)':'var(--text-2)'};
                             font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s">Нет</button>
                  </div>
                </div>`; }).join('')}
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:16px">
            ${page > 0
              ? `<button class="btn btn-ghost" id="phil-prev">← Назад</button>`
              : '<div></div>'}
            ${page < totalPages - 1
              ? `<button class="btn btn-primary" id="phil-next">Далее →</button>`
              : `<button class="btn btn-primary" id="phil-done" ${filled < 58 ? 'disabled title="Ответьте на все вопросы"' : ''}>Завершить →</button>`}
          </div>
        </div>`;

      body.querySelectorAll('.phil-ans').forEach(btn => {
        btn.addEventListener('click', () => {
          answers[+btn.dataset.i] = +btn.dataset.v;
          render(page);
        });
      });
      body.querySelector('#phil-prev')?.addEventListener('click', () => render(page-1));
      body.querySelector('#phil-next')?.addEventListener('click', () => render(page+1));
      body.querySelector('#phil-done')?.addEventListener('click', () => {
        onDone({ answers: answers.map(a => a ?? 0) });
      });
    };
    render(0);
  },

  // ── 8. Мотивация учения (Лусканова) ──────────────────────────────────────
  luskan(el, onDone) {
    const body   = document.getElementById('dp-body');
    const topbar = document.getElementById('dp-topbar-right');
    const answers = Array(10).fill(null); // баллы за каждый ответ

    const render = (qi) => {
      const q   = LUSKAN_QUESTIONS[qi];
      const pct = Math.round(qi / 10 * 100);

      topbar.innerHTML = `
        <span style="font-size:13px;color:var(--text-3)">Вопрос ${qi+1} из 10</span>
        <div style="width:100px;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-left:10px">
          <div style="width:${pct}%;height:100%;background:var(--indigo)"></div>
        </div>`;

      body.innerHTML = `
        <div style="max-width:560px;width:100%">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:32px">
            <div style="font-size:12px;font-weight:700;color:var(--indigo);text-transform:uppercase;margin-bottom:14px">
              Вопрос ${qi+1} из ${LUSKAN_QUESTIONS.length}
            </div>
            <div style="font-size:16px;font-weight:500;color:var(--text-1);line-height:1.6;margin-bottom:28px">
              ${escHtml(q.text)}
            </div>
            <div style="display:flex;flex-direction:column;gap:10px" id="luskan-opts"></div>
          </div>
        </div>`;

      const container = document.getElementById('luskan-opts');
      q.opts.forEach((opt, oi) => {
        const btn = document.createElement('button');
        const prevScore = answers[qi];
        const isSelected = prevScore === q.scores[oi];
        btn.className = 'player-opt';
        btn.style.cssText = `font-size:14px;padding:14px 20px;text-align:left;border:2px solid ${isSelected?'var(--indigo)':'var(--border)'};background:${isSelected?'var(--indigo-l)':'var(--surface)'};color:${isSelected?'var(--indigo)':'var(--text-1)'};transition:all .15s`;
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          answers[qi] = q.scores[oi];
          if (qi + 1 < LUSKAN_QUESTIONS.length) {
            render(qi + 1);
          } else {
            onDone({ answers });
          }
        });
        container.appendChild(btn);
      });
    };
    render(0);
  },

  // ── 9. Социометрия ───────────────────────────────────────────────────────
  sociometry(el, onDone) {
    const body   = document.getElementById('dp-body');
    const topbar = document.getElementById('dp-topbar-right');
    let pupils   = [];
    let choices  = {}; // {0: [1,2,3], 1: [0,2], ...}
    let step     = 'setup'; // 'setup' | 'enter' | 'result'
    let curPupil = 0;
    const MAX_CHOICES = 3;

    const renderSetup = () => {
      topbar.innerHTML = '';
      body.innerHTML = `
        <div style="max-width:560px;width:100%">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px">
            <div style="font-size:18px;font-weight:700;color:var(--text-1);margin-bottom:6px">Список класса</div>
            <div style="font-size:13px;color:var(--text-3);margin-bottom:20px">Введите имена учеников (каждое с новой строки)</div>
            <textarea class="input-field" id="soc-names" placeholder="Иванов Иван&#10;Петрова Мария&#10;Сидоров Алексей&#10;..."
              style="height:200px;font-size:13.5px;line-height:1.8">${pupils.join('\n')}</textarea>
            <div style="margin-top:16px;text-align:right">
              <button class="btn btn-primary" id="soc-start">Начать заполнение →</button>
            </div>
          </div>
        </div>`;

      body.querySelector('#soc-start').addEventListener('click', () => {
        const lines = document.getElementById('soc-names').value
          .split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length < 3) { toast('Введите минимум 3 ученика', 'error'); return; }
        pupils  = lines;
        choices = {};
        pupils.forEach((_, i) => { choices[i] = []; });
        curPupil = 0;
        step = 'enter';
        renderEntry();
      });
    };

    const renderEntry = () => {
      const name = pupils[curPupil];
      const chosen = choices[curPupil] || [];
      const pct    = Math.round(curPupil / pupils.length * 100);

      topbar.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:13px;color:var(--text-3)">Ученик ${curPupil+1} из ${pupils.length}</span>
          <div style="width:100px;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--indigo)"></div>
          </div>
        </div>`;

      body.innerHTML = `
        <div style="max-width:580px;width:100%">
          <div style="background:var(--indigo-l);border:1px solid var(--indigo-m);border-radius:var(--r-xl);padding:18px 22px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:700;color:var(--indigo);text-transform:uppercase;margin-bottom:4px">Заполняет</div>
            <div style="font-size:20px;font-weight:700;color:var(--indigo)">${escHtml(name)}</div>
            <div style="font-size:12.5px;color:var(--indigo);opacity:.7;margin-top:4px">
              Выбрано: ${chosen.length} из ${MAX_CHOICES}
            </div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px">
            <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:14px">
              С кем бы ты хотел сидеть за одной партой? (выбери до 3)
            </div>
            <div style="display:flex;flex-direction:column;gap:8px" id="soc-pupils"></div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:space-between">
            ${curPupil > 0 ? '<button class="btn btn-ghost" id="soc-prev">← Назад</button>' : '<div></div>'}
            <button class="btn btn-primary" id="soc-next">
              ${curPupil < pupils.length-1 ? 'Следующий →' : 'Рассчитать →'}
            </button>
          </div>
        </div>`;

      const container = document.getElementById('soc-pupils');
      pupils.forEach((pName, pi) => {
        if (pi === curPupil) return;
        const isSel = chosen.includes(pi);
        const div = document.createElement('div');
        div.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--r-md);cursor:pointer;border:2px solid ${isSel?'var(--indigo)':'var(--border)'};background:${isSel?'var(--indigo-l)':'var(--surface)'};transition:all .15s`;
        div.innerHTML = `
          <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isSel?'var(--indigo)':'var(--border-2)'};background:${isSel?'var(--indigo)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${isSel ? '<span style="color:#fff;font-size:11px">✓</span>' : ''}
          </div>
          <span style="font-size:13.5px;font-weight:${isSel?'600':'400'};color:${isSel?'var(--indigo)':'var(--text-1)'}">${escHtml(pName)}</span>`;
        div.addEventListener('click', () => {
          const idx = choices[curPupil].indexOf(pi);
          if (idx >= 0) {
            choices[curPupil].splice(idx, 1);
          } else if (choices[curPupil].length < MAX_CHOICES) {
            choices[curPupil].push(pi);
          } else {
            toast(`Максимум ${MAX_CHOICES} выбора`, 'error');
            return;
          }
          renderEntry();
        });
        container.appendChild(div);
      });

      body.querySelector('#soc-prev')?.addEventListener('click', () => { curPupil--; renderEntry(); });
      body.querySelector('#soc-next')?.addEventListener('click', () => {
        if (curPupil < pupils.length - 1) {
          curPupil++;
          renderEntry();
        } else {
          onDone({ pupils, choices });
        }
      });
    };

    renderSetup();
  },

  // ── 10. ВАШ — Визуальная аналоговая шкала ────────────────────────────────
  vas(el, onDone) {
    const body   = document.getElementById('dp-body');
    const topbar = document.getElementById('dp-topbar-right');
    const VAS_SCALES = [
      { key: 'mood',     label: 'Настроение',   low: '😞 Очень плохое', high: '😄 Отличное',      color: 'var(--indigo)' },
      { key: 'energy',   label: 'Энергия',      low: '🔋 Нет сил',      high: '⚡ Полон сил',      color: 'var(--green)' },
      { key: 'anxiety',  label: 'Тревога',      low: '😌 Спокойно',     high: '😰 Очень тревожно', color: 'var(--rose)' },
      { key: 'interest', label: 'Интерес',      low: '😴 Скучно',       high: '🤩 Очень интересно', color: 'var(--amber)' },
      { key: 'comfort',  label: 'Комфорт',      low: '😣 Некомфортно',  high: '😊 Комфортно',      color: 'var(--teal)' },
    ];
    const vals = { mood: 5, energy: 5, anxiety: 0, interest: 5, comfort: 5 };

    const render = () => {
      topbar.innerHTML = '';
      body.innerHTML = `
        <div style="max-width:580px;width:100%">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:28px">
            <div style="font-size:17px;font-weight:700;color:var(--text-1);margin-bottom:4px">Как я себя чувствую?</div>
            <div style="font-size:13px;color:var(--text-3);margin-bottom:24px">Передвигай ползунки — отметь своё состояние прямо сейчас</div>
            <div style="display:flex;flex-direction:column;gap:24px" id="vas-sliders"></div>
            <div style="margin-top:24px;text-align:right">
              <button class="btn btn-primary" id="vas-done" style="font-size:14px;padding:11px 28px">Сохранить →</button>
            </div>
          </div>
        </div>`;

      const container = document.getElementById('vas-sliders');
      VAS_SCALES.forEach(sc => {
        const v   = vals[sc.key];
        const div = document.createElement('div');
        div.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:13.5px;font-weight:700;color:var(--text-1)">${sc.label}</div>
            <div style="font-size:16px;font-weight:700;color:${sc.color};min-width:28px;text-align:right">${v}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:12px;color:var(--text-3);min-width:110px;text-align:right">${sc.low}</div>
            <input type="range" min="0" max="10" value="${v}" class="vas-slider" data-key="${sc.key}"
              style="flex:1;accent-color:${sc.color};cursor:pointer;height:6px">
            <div style="font-size:12px;color:var(--text-3);min-width:110px">${sc.high}</div>
          </div>
          <div style="display:flex;justify-content:center;gap:0;margin-top:6px">
            ${Array.from({length:11},(_,i) => `
              <div style="flex:1;text-align:center;font-size:10px;color:${v===i?sc.color:'var(--text-3)'};font-weight:${v===i?'700':'400'}">${i}</div>`
            ).join('')}
          </div>`;
        container.appendChild(div);
      });

      container.querySelectorAll('.vas-slider').forEach(inp => {
        inp.addEventListener('input', () => {
          vals[inp.dataset.key] = parseInt(inp.value);
          render();
        });
      });

      body.querySelector('#vas-done').addEventListener('click', () => {
        onDone({ sliders: { ...vals } });
      });
    };
    render();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  ХЕЛПЕРЫ ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ МЕТОДИК v2
// ══════════════════════════════════════════════════════════════════════════════

// Рендер ответа для одного элемента v2
function renderV2Answer(elem, container, answers, onNext) {
  if (!container) return;
  const ans = elem.answer;

  if (ans.type === 'yesno' || ans.type === 'checkbox' || ans.type === 'variants' || ans.type === 'scale') {
    const opts      = ans.options || [];
    const prevAns   = answers[elem.id];
    const autoNext  = !onNext ? false : (ans.type !== 'variants');

    container.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:10px" id="v2-opts-${elem.id}">
        ${opts.map((opt, i) => `
          <button class="player-opt v2-opt" data-i="${i}"
            style="font-size:14px;padding:12px 20px;min-height:auto;
                   border-color:${prevAns?.optIndex===i?'var(--indigo)':'var(--border)'};
                   background:${prevAns?.optIndex===i?'var(--indigo-l)':'var(--surface)'};
                   color:${prevAns?.optIndex===i?'var(--indigo)':'var(--text-1)'}">
            ${escHtml(opt)}
          </button>`).join('')}
      </div>
      ${onNext ? `<div style="margin-top:12px;text-align:right">
        <button class="btn btn-primary v2-next" ${!prevAns?'disabled':''}>Далее →</button>
      </div>` : ''}`;

    container.querySelectorAll('.v2-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const i     = +btn.dataset.i;
        const score = elem.weight?.scores?.[i] ?? 0;
        answers[elem.id] = { optIndex: i, label: opts[i], score };

        container.querySelectorAll('.v2-opt').forEach((b, bi) => {
          const sel = bi === i;
          b.style.borderColor = sel ? 'var(--indigo)' : 'var(--border)';
          b.style.background  = sel ? 'var(--indigo-l)' : 'var(--surface)';
          b.style.color       = sel ? 'var(--indigo)' : 'var(--text-1)';
        });

        const nextBtn = container.querySelector('.v2-next');
        if (nextBtn) nextBtn.disabled = false;
        if (onNext && autoNext) setTimeout(onNext, 380);
      });
    });
    container.querySelector('.v2-next')?.addEventListener('click', () => { if (answers[elem.id]) onNext(); });

  } else if (ans.type === 'number') {
    const prev = answers[elem.id]?.value ?? '';
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        <input type="number" class="input-field v2-num" min="${ans.min||0}" max="${ans.max||9999}" value="${prev}"
          placeholder="${ans.min||0} — ${ans.max||9999}"
          style="max-width:160px;font-size:20px;font-weight:700;text-align:center;padding:12px">
        <span style="font-size:13px;color:var(--text-3)">Диапазон: ${ans.min||0} — ${ans.max||9999}</span>
      </div>
      ${onNext ? `<div style="margin-top:12px;text-align:right">
        <button class="btn btn-primary v2-next" ${!prev?'disabled':''}>Далее →</button>
      </div>` : ''}`;

    const numInp = container.querySelector('.v2-num');
    numInp.addEventListener('input', () => {
      const v = parseFloat(numInp.value) || 0;
      answers[elem.id] = { value: v, score: v };
      const nb = container.querySelector('.v2-next');
      if (nb) nb.disabled = false;
    });
    container.querySelector('.v2-next')?.addEventListener('click', () => { if (answers[elem.id]) onNext(); });
  }
}

// Подсчёт баллов для v2
function calcV2Scores(data, answers) {
  let total = 0;
  const subscaleScores = {};

  (data.elements || []).forEach(elem => {
    if (elem.type === 'info' || !elem.answer) return;
    const ans = answers[elem.id];
    if (!ans) return;

    let score = 0;
    if (ans.score !== undefined) {
      score = ans.score;
    } else if (ans.optIndex !== undefined && elem.weight?.scores) {
      score = elem.weight.scores[ans.optIndex] ?? 0;
    }

    total += score;
    if (elem.weight?.subscale) {
      subscaleScores[elem.weight.subscale] = (subscaleScores[elem.weight.subscale] || 0) + score;
    }
  });

  const answered  = Object.keys(answers).length;
  const _findR    = (ranges, val) => ranges?.find(r => val >= r.from && val <= r.to) || null;
  const mainRange = data.interpretation?.ranges?.length ? _findR(data.interpretation.ranges, total) : null;
  const rangeHead = mainRange?.label?.split('\n')[0]?.trim();
  const summary   = rangeHead
    ? `Сумма: ${total} — ${rangeHead}`
    : data.interpretation
      ? `Сумма: ${total}`
      : `${answered} ответов`;

  return { total, subscaleScores, summary };
}

// Экран результата для v2
// ══════════════════════════════════════════════════════════════════════════════
//  ЭКРАН РЕЗУЛЬТАТА v2 — ИНФОРМАТИВНАЯ КАРТОЧКА
// ══════════════════════════════════════════════════════════════════════════════

async function showV2Result(overlay, diag, data, total, subscaleScores, summary, student, onClose, savedResultId) {

  // ── Вспомогательные константы ─────────────────────────────────────────────
  const LC = {
    norm:      { label:'Норма',                col:'var(--green)',  bg:'var(--green-l)',  border:'rgba(22,163,74,.25)',   icon:'✓' },
    attention: { label:'Вызывает внимание',    col:'var(--amber)',  bg:'var(--amber-l)',  border:'rgba(217,119,6,.25)',   icon:'⚠' },
    risk:      { label:'Требует консультации', col:'var(--rose)',   bg:'var(--rose-l)',   border:'rgba(220,38,38,.25)',   icon:'!' },
    none:      { label:'',                     col:'var(--text-3)', bg:'var(--surface-2)',border:'var(--border)',         icon:'—' },
  };

  const findRange  = (ranges, val) => ranges?.find(r => val >= r.from && val <= r.to) || null;
  const scoreRange = (ranges) => ranges?.length
    ? { min: ranges[0].from, max: ranges[ranges.length-1].to }
    : { min: 0, max: 1 };
  const pct = (v, mn, mx) => Math.round(Math.max(0, Math.min(100, (v-mn)/(mx-mn)*100)));
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'}); } catch(e) { return iso; } };

  const interp   = data.interpretation;
  const hasInterp = interp?.ranges?.length > 0;
  const mainRange = hasInterp ? findRange(interp.ranges, total) : null;
  const level     = mainRange?.level || 'none';
  const lc        = LC[level] || LC.none;

  // ── Подшкалы: data.subscales — массив строк (имён) из конструктора ─────────
  // subById не используется; subscaleScores и subscaleRanges уже keyed по имени
  const subById = {};

  // ── История: загрузить предыдущие результаты ──────────────────────────────
  let history = [];
  if (student?.id && diag.id) {
    try {
      history = await window.db.diagnostics.getHistory({ diagnostic_id: diag.id, student_id: student.id });
    } catch(e) { history = []; }
  }
  const prevNotes = history.find(r => r.id === savedResultId)?.psychologist_notes || '';

  // ── Разобрать label на секции (формат: строки с ключевыми словами) ─────────
  // label может содержать \n\n для разделения абзацев и строки вида "• ..." для списков
  function parseLabelSections(label) {
    if (!label) return { heading: '', paragraphs: [], causes: [], recs: [] };
    const lines = label.split('\n').map(l => l.trim()).filter(Boolean);
    const heading    = lines[0] || '';
    const paragraphs = [];
    const causes     = [];
    const recs       = [];
    let mode = 'para';
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (/возможн|причин/i.test(l) && l.endsWith(':')) { mode = 'causes'; continue; }
      if (/рекоменд/i.test(l) && l.endsWith(':'))        { mode = 'recs';   continue; }
      if (l.startsWith('•') || l.startsWith('-'))  {
        const text = l.replace(/^[•\-]\s*/, '');
        if (mode === 'causes') causes.push(text);
        else if (mode === 'recs') recs.push(text);
        else paragraphs.push(text);
      } else {
        if (mode === 'para') paragraphs.push(l);
        else if (mode === 'causes') causes.push(l);
        else recs.push(l);
      }
    }
    return { heading, paragraphs, causes, recs };
  }

  const parsed = parseLabelSections(mainRange?.label || '');
  const { min: sMin, max: sMax } = scoreRange(interp?.ranges);
  const scoreP = pct(total, sMin, sMax);

  // ── Построить HTML карточки ───────────────────────────────────────────────
  const studentName = student ? `${student.first_name} ${student.last_name||''}`.trim() : null;
  const dateStr     = fmtDate(new Date().toISOString());

  // БЛОК: Шапка
  const blockHeader = `
    <div class="rc-card" style="animation-delay:0s">
      <div class="rc-sec-head">
        <span class="rc-sec-icon">📋</span>
        <span class="rc-sec-label">Диагностическое обследование</span>
      </div>
      <div style="padding:18px 22px">
        <div style="font-size:18px;font-weight:800;color:var(--text-1);line-height:1.25;margin-bottom:8px">${escHtml(diag.name)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">
          ${studentName ? `<span class="rc-chip">👤 ${escHtml(studentName)}</span>` : ''}
          <span class="rc-chip">📅 ${dateStr}</span>
          <span class="rc-chip">🔍 ${diag.fill_by === 'student' ? 'Сам ученик' : diag.fill_by === 'parent' ? 'Родитель' : 'Педагог-психолог'}</span>
        </div>
      </div>
    </div>`;

  // БЛОК: Вердикт
  const blockVerdict = hasInterp ? `
    <div class="rc-card" style="animation-delay:.05s;border-color:${lc.border};border-width:2px">
      <div class="rc-sec-head">
        <span class="rc-sec-icon">📊</span>
        <span class="rc-sec-label">Итоговый результат</span>
      </div>
      <div style="padding:18px 22px">
        <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 13px;border-radius:20px;
             background:${lc.bg};border:1px solid ${lc.border};
             font-size:12px;font-weight:700;color:${lc.col};margin-bottom:10px">
          ${lc.icon} ${lc.label}
        </div>
        ${parsed.heading ? `<div style="font-size:18px;font-weight:800;color:${lc.col};line-height:1.3;margin-bottom:12px">${escHtml(parsed.heading)}</div>` : ''}
        <div style="display:flex;align-items:flex-end;gap:10px;margin-bottom:14px">
          <span style="font-size:32px;font-weight:900;color:${lc.col};line-height:1">${total}</span>
          <span style="font-size:13px;color:var(--text-3);margin-bottom:4px">из ${sMax} баллов</span>
        </div>
        <!-- Прогресс-бар с зонами -->
        <div style="margin-bottom:6px;height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden;position:relative">
          ${interp.ranges.map(r => {
            const rFrom = pct(r.from, sMin, sMax);
            const rTo   = pct(r.to,   sMin, sMax);
            const rCol  = LC[r.level||'none']?.col || 'var(--text-4)';
            return `<div style="position:absolute;left:${rFrom}%;width:${rTo-rFrom+1}%;height:100%;background:${rCol};opacity:.18"></div>`;
          }).join('')}
          <div id="rc-prog-fill" style="height:100%;width:0%;background:${lc.col};border-radius:5px;
               transition:width .9s cubic-bezier(.4,0,.2,1) .15s;position:relative;z-index:1"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-4)">
          <span>${sMin}</span>
          ${interp.ranges.map(r => `<span style="color:${LC[r.level||'none']?.col};font-weight:600">${escHtml(r.label.split('\n')[0].slice(0,22))}</span>`).join('')}
          <span>${sMax}</span>
        </div>
      </div>
    </div>` : `
    <div class="rc-card" style="animation-delay:.05s">
      <div style="padding:20px 22px;text-align:center;color:var(--text-3)">
        <div style="font-size:36px;margin-bottom:8px">📝</div>
        <div style="font-size:14px">Интерпретация для этой методики не задана</div>
        <div style="font-size:13px;margin-top:4px">Итоговая сумма: <b style="color:var(--indigo)">${total}</b></div>
      </div>
    </div>`;

  // БЛОК: Что это значит
  // desc — поле из конструктора диагностик (шаг 3, textarea)
  // parsed.paragraphs/causes — для встроенных методик с многострочным label
  const descText  = mainRange?.desc?.trim() || '';
  const hasDesc   = descText || parsed.paragraphs.length || parsed.causes.length;
  const blockDesc = hasDesc ? `
    <div class="rc-card" style="animation-delay:.10s">
      <div class="rc-sec-head">
        <span class="rc-sec-icon">💬</span>
        <span class="rc-sec-label">Что это значит</span>
      </div>
      <div style="padding:18px 22px;font-size:14px;line-height:1.75;color:var(--text-2)">
        ${descText ? descText.split('\n').map(p => p.trim() ? `<p style="margin-bottom:10px">${escHtml(p)}</p>` : '').join('') : ''}
        ${parsed.paragraphs.map(p => `<p style="margin-bottom:10px">${escHtml(p)}</p>`).join('')}
        ${parsed.causes.length ? `
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-top:4px;margin-bottom:8px">
            ${level === 'norm' ? 'Обратите внимание' : 'Возможные причины'}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${parsed.causes.map(c => `
              <div style="display:flex;gap:9px;align-items:flex-start">
                <div style="width:6px;height:6px;border-radius:50%;background:var(--text-4);flex-shrink:0;margin-top:8px"></div>
                <span style="font-size:13.5px">${escHtml(c)}</span>
              </div>`).join('')}
          </div>` : ''}
      </div>
    </div>` : '';

  // БЛОК: Рекомендации из методики + заметки психолога
  const blockRecs = `
    <div class="rc-card" style="animation-delay:.15s">
      <div class="rc-sec-head">
        <span class="rc-sec-icon">${level === 'norm' ? '✓' : '⚡'}</span>
        <span class="rc-sec-label">Рекомендации</span>
      </div>
      <div style="padding:18px 22px">
        ${parsed.recs.length ? `
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px">Из методики</div>
            <div style="display:flex;flex-direction:column;gap:7px">
              ${parsed.recs.map((r, i) => `
                <div style="display:flex;gap:11px;align-items:flex-start;padding:9px 13px;
                     background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg)">
                  <div style="width:22px;height:22px;border-radius:50%;background:var(--indigo-l);color:var(--indigo);
                       font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
                  <div style="font-size:13.5px;line-height:1.6;color:var(--text-2)">${escHtml(r)}</div>
                </div>`).join('')}
            </div>
          </div>` : ''}
        <div>
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Заметки психолога</div>
          <textarea id="rc-notes"
            placeholder="Дополнительные наблюдения, план работы, контекст..."
            style="width:100%;min-height:90px;padding:11px 14px;
                   background:var(--surface-2);border:1px solid var(--border);
                   border-radius:var(--r-lg);font-family:inherit;font-size:13.5px;
                   line-height:1.6;color:var(--text-1);resize:vertical;
                   transition:border-color .15s;outline:none"
            onfocus="this.style.borderColor='var(--indigo)'"
            onblur="this.style.borderColor='var(--border)'"
          >${escHtml(prevNotes)}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-sm" id="rc-save-notes"
              style="font-size:12px;padding:5px 14px;background:var(--indigo-l);color:var(--indigo);border-color:rgba(79,96,235,.2)">
              Сохранить заметку
            </button>
          </div>
        </div>
      </div>
    </div>`;

  // БЛОК: Подшкалы
  let blockSubs = '';
  if (Object.keys(subscaleScores).length && interp?.subscaleRanges) {
    const subRows = Object.entries(subscaleScores).map(([subId, val]) => {
      const subName   = subById[subId] || subId;
      const subRanges = interp.subscaleRanges?.[subId] || [];
      const subRange  = findRange(subRanges, val);
      const slc       = LC[subRange?.level || 'none'] || LC.none;
      const { min: sn, max: sx } = scoreRange(subRanges);
      const sp        = pct(val, sn, sx);
      return { subId, subName, val, sn, sx, sp, subRange, slc };
    });
    blockSubs = `
      <div class="rc-card" style="animation-delay:.20s">
        <div class="rc-sec-head">
          <span class="rc-sec-icon">📐</span>
          <span class="rc-sec-label">По подшкалам</span>
        </div>
        <div style="padding:16px 22px;display:flex;flex-direction:column;gap:14px">
          ${subRows.map((s, si) => `
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
                <span style="font-size:13px;font-weight:700;color:var(--text-1);flex:1">${escHtml(s.subName)}</span>
                <span style="font-size:14px;font-weight:800;color:${s.slc.col}">${s.val} / ${s.sx}</span>
                <span style="font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;
                      background:${s.slc.bg};color:${s.slc.col};border:1px solid ${s.slc.border}">${s.slc.label}</span>
              </div>
              <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-bottom:6px">
                <div class="rc-sub-bar" data-pct="${s.sp}" data-col="${s.slc.col}"
                     style="height:100%;width:0%;background:${s.slc.col};border-radius:3px;
                            transition:width .7s cubic-bezier(.4,0,.2,1) ${.25+si*.08}s"></div>
              </div>
              ${s.subRange?.label ? `<div style="font-size:12.5px;color:var(--text-3);line-height:1.55">${escHtml(s.subRange.label.split('\n')[0])}</div>` : ''}
              ${s.subRange?.desc?.trim() ? `<div style="font-size:12.5px;color:var(--text-2);line-height:1.65;margin-top:5px">${s.subRange.desc.trim().split('\n').map(l => escHtml(l)).join('<br>')}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }

  // БЛОК: Динамика
  let blockHistory = '';
  if (history.length > 1 && hasInterp) {
    const maxVal = Math.max(...history.map(h => { try { return JSON.parse(h.scores).total||0; } catch(e){return 0;} }));
    const histItems = history.map(h => {
      let hTotal = 0;
      try { hTotal = JSON.parse(h.scores).total || 0; } catch(e) {}
      const hRange = findRange(interp.ranges, hTotal);
      const hlc    = LC[hRange?.level || 'none'] || LC.none;
      const hp     = Math.max(8, Math.round(hTotal / (maxVal||1) * 68));
      return { date: fmtDate(h.completed_at).replace(' г.',''), val: hTotal, col: hlc.col, hp };
    });
    blockHistory = `
      <div class="rc-card" style="animation-delay:.25s">
        <div class="rc-sec-head">
          <span class="rc-sec-icon">📈</span>
          <span class="rc-sec-label">Динамика (${history.length} проведений)</span>
        </div>
        <div style="padding:16px 22px">
          <div style="display:flex;align-items:flex-end;gap:10px;height:88px;margin-bottom:10px">
            ${histItems.map(h => `
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
                <span style="font-size:11px;font-weight:700;color:var(--text-3)">${h.val}</span>
                <div style="flex:1;display:flex;align-items:flex-end;width:100%">
                  <div style="width:100%;height:${h.hp}px;border-radius:4px 4px 0 0;background:${h.col};opacity:.75"></div>
                </div>
                <span style="font-size:10px;color:var(--text-4);text-align:center;line-height:1.3">${escHtml(h.date)}</span>
              </div>`).join('')}
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            ${['norm','attention','risk'].map(k => `
              <div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-3)">
                <div style="width:8px;height:8px;border-radius:50%;background:${LC[k].col}"></div>
                <span>${LC[k].label}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  // ── Print CSS (инжектируем один раз) ─────────────────────────────────────
  if (!document.getElementById('rc-print-style')) {
    const ps = document.createElement('style');
    ps.id = 'rc-print-style';
    ps.textContent = `
      @media print {
        body > *:not(#rc-print-root) { display:none !important; }
        #rc-print-root { display:block !important; position:static !important; }
        .rc-topbar { display:none !important; }
        .rc-print-header { display:block !important; }
        .rc-actions { display:none !important; }
        textarea#rc-notes { border:1px solid #ccc !important; background:#fff !important; }
        .rc-card { break-inside:avoid; page-break-inside:avoid; box-shadow:none !important;
                   border:1px solid #e0e0e0 !important; margin-bottom:12px !important; }
      }
      @media screen {
        .rc-print-header { display:none; }
        @keyframes rcIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .rc-card { animation:rcIn .3s ease both; }
      }
    `;
    document.head.appendChild(ps);
  }

  // ── Рендер оверлея ────────────────────────────────────────────────────────
  overlay.id = 'rc-print-root';
  overlay.innerHTML = `
    <!-- Печатная шапка (только при print) -->
    <div class="rc-print-header" style="padding:16px 24px 12px;border-bottom:2px solid #e0e0e0;margin-bottom:16px">
      ${studentName ? `<div style="font-size:16px;font-weight:700">${escHtml(studentName)}</div>` : ''}
      <div style="font-size:14px;color:#555">${escHtml(diag.name)} · ${dateStr}</div>
    </div>

    <!-- Topbar -->
    <div class="player-topbar rc-topbar">
      <button class="btn btn-ghost btn-sm" id="rc-close">← Закрыть</button>
      <div style="font-size:14px;font-weight:600;color:var(--text-2);flex:1;margin-left:8px">${escHtml(diag.name)}</div>
      <div class="rc-actions" style="display:flex;gap:8px">
        <button class="btn btn-sm" id="rc-print"
          style="background:var(--indigo-l);color:var(--indigo);border-color:rgba(79,96,235,.2);font-size:12px">
          📄 Печать / PDF
        </button>
      </div>
    </div>

    <!-- Тело -->
    <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:24px 32px" id="rc-body">
      <div style="width:100%;max-width:720px;display:flex;flex-direction:column;gap:12px">
        ${blockHeader}
        ${blockVerdict}
        ${blockDesc}
        ${blockRecs}
        ${blockSubs}
        ${blockHistory}
        ${studentName ? `
          <div style="display:flex;align-items:center;gap:8px;padding:11px 16px;border-radius:var(--r-lg);
               background:var(--green-l);border:1px solid rgba(22,163,74,.2);
               font-size:13px;color:var(--green);font-weight:600;animation:rcIn .3s ease both;animation-delay:.3s">
            ✓ Результат сохранён · ${escHtml(studentName)}
          </div>` : ''}
      </div>
    </div>`;

  // ── Анимировать прогресс-бары ─────────────────────────────────────────────
  requestAnimationFrame(() => {
    setTimeout(() => {
      const pf = overlay.querySelector('#rc-prog-fill');
      if (pf) pf.style.width = scoreP + '%';
      overlay.querySelectorAll('.rc-sub-bar').forEach(bar => {
        bar.style.width = bar.dataset.pct + '%';
      });
    }, 100);
  });

  // ── Кнопки ────────────────────────────────────────────────────────────────
  overlay.querySelector('#rc-close').addEventListener('click', onClose);

  overlay.querySelector('#rc-print').addEventListener('click', () => window.print());

  const notesEl = overlay.querySelector('#rc-notes');
  overlay.querySelector('#rc-save-notes').addEventListener('click', async () => {
    const btn = overlay.querySelector('#rc-save-notes');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;
    try {
      if (savedResultId) {
        await window.db.diagnostics.updateNotes({ result_id: savedResultId, notes: notesEl.value });
      }
      btn.textContent = '✓ Сохранено';
      btn.style.background = 'var(--green-l)';
      btn.style.color = 'var(--green)';
      btn.style.borderColor = 'rgba(22,163,74,.2)';
    } catch(e) {
      btn.textContent = 'Ошибка';
      btn.disabled = false;
    }
  });

  // Стили для карточек (вставить как CSS-переменные Вехи уже определены)
  const styleId = 'rc-card-style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      .rc-card {
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:var(--r-xl);
        overflow:hidden;
      }
      .rc-sec-head {
        display:flex;align-items:center;gap:7px;
        padding:11px 18px;
        border-bottom:1px solid var(--border);
        background:var(--surface-2);
      }
      .rc-sec-icon { font-size:13px; }
      .rc-sec-label {
        font-size:11px;font-weight:700;
        letter-spacing:.07em;text-transform:uppercase;
        color:var(--text-3);
      }
      .rc-chip {
        display:inline-flex;align-items:center;gap:4px;
        padding:3px 10px;border-radius:20px;
        font-size:12px;font-weight:600;
        background:var(--surface-2);border:1px solid var(--border);color:var(--text-3);
      }
    `;
    document.head.appendChild(s);
  }
}

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

  let data;
  try {
    const raw = JSON.parse(d.questions || 'null');
    if (raw && raw.version === 2) {
      data = raw;
    } else if (Array.isArray(raw) && raw.length) {
      data = raw; // старый формат — массив
    } else {
      toast('Нет элементов — откройте редактор', 'error'); return;
    }
  } catch(e) {
    toast('Нет элементов — откройте редактор', 'error'); return;
  }

  // Проверяем что есть что показывать
  if (data.version === 2) {
    const hasContent = data.elements?.some(e => e.type !== 'info' || e.stimulus?.text);
    if (!hasContent) { toast('Нет элементов — откройте редактор', 'error'); return; }
  }

  const student = studentId ? await window.db.students.get(studentId) : null;
  DiagPlayer._runCustom(d, data, student);
};
