// ══════════════════════════════════════════════════════════════════════════════
//  ПЛЕЕР УПРАЖНЕНИЙ
// ══════════════════════════════════════════════════════════════════════════════

const Player = {
  _el: null,

  async start(exerciseId, studentId) {
    Sound.start();
    const ex = await window.db.exercises.get(exerciseId);
    if (!ex) { toast('Упражнение не найдено', 'error'); return; }
    let content = {};
    try { content = JSON.parse(ex.content || '{}'); } catch(e) {}
    this._launch(ex, content, studentId);
  },

  _launch(ex, content, studentId) {
    this._el?.remove();
    const el = document.createElement('div');
    el.className = 'player-overlay';
    el.id = 'player-overlay';
    document.body.appendChild(el);
    this._el = el;

    // Все 19 типов — вызываем после создания _el
    // setTimeout(0) гарантирует что все Object.assign(PlayerTypes,...) уже выполнены
    const self = this;
    setTimeout(function() {
      const pt = PlayerTypes;
      const map = {
        visual_match:  () => pt.visualMatch(ex, content, studentId, self),
        find_pairs:    () => pt.findPairs(ex, content, studentId, self),
        memory_game:   () => pt.memory_game(ex, content, studentId, self),
        odd_one_out:   () => pt.oddOneOut(ex, content, studentId, self),
        sorting:       () => pt.sorting(ex, content, studentId, self),
        sequencing:    () => pt.sequencing(ex, content, studentId, self),
        story_order:   () => pt.story_order(ex, content, studentId, self),
        whats_missing: () => pt.whats_missing(ex, content, studentId, self),
        categories:    () => pt.categories(ex, content, studentId, self),
        pattern:       () => pt.pattern(ex, content, studentId, self),
        word_to_pic:   () => pt.word_to_pic(ex, content, studentId, self),
        word_builder:  () => pt.word_builder(ex, content, studentId, self),
        fill_blank:    () => pt.fill_blank(ex, content, studentId, self),
        first_sound:   () => pt.first_sound(ex, content, studentId, self),
        counting:      () => pt.counting(ex, content, studentId, self),
        size_order:    () => pt.size_order(ex, content, studentId, self),
        compare:       () => pt.compare(ex, content, studentId, self),
        true_false:    () => pt.true_false(ex, content, studentId, self),
        emotion_match: () => pt.emotion_match(ex, content, studentId, self),
      };
      const fn = map[ex.type];
      if (fn) {
        fn();
      } else {
        el.innerHTML = `
          <div class="player-topbar">
            <button class="btn btn-ghost btn-sm" id="player-close-empty">Закрыть</button>
            <div style="font-size:15px;font-weight:600">${escHtml(ex.name)}</div>
          </div>
          <div class="player-body">
            <div class="player-card" style="text-align:center">
              <div style="font-size:18px;color:var(--text-3)">Тип &laquo;${escHtml(ex.type)}&raquo; не поддерживается</div>
            </div>
          </div>`;
        el.querySelector('#player-close-empty').addEventListener('click', () => self.close());
      }
    }, 0);
  },

  close() {
    this._el?.remove();
    this._el = null;
  },

  async _saveResult(studentId, exerciseId, correct, total, answers, durationSec) {
    if (!studentId) return;
    await window.db.exercises.saveResult({
      student_id:   studentId,
      exercise_id:  exerciseId,
      correct, total,
      score:        total > 0 ? Math.round(correct / total * 100) + '%' : '—',
      duration_sec: durationSec,
      answers,
    });
  },
};

// ── Топбар ────────────────────────────────────────────────────────────────────
function playerTopbar(name, current, total) {
  const pct = total > 0 ? Math.round(current / total * 100) : 0;
  return `
    <div class="player-topbar">
      <button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button>
      <div style="font-size:14px;font-weight:600;color:var(--text-2)">${escHtml(name)}</div>
      <div class="player-progress-bar">
        <div class="player-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="player-counter">${current} / ${total}</div>
    </div>`;
}

function bindCloseBtn(el) {
  el.querySelectorAll('.player-close-btn').forEach(btn => {
    btn.addEventListener('click', () => Player.close());
  });
}

// ── Экран результата ──────────────────────────────────────────────────────────
function showResult(el, correct, total) {
  const pct   = total > 0 ? Math.round(correct / total * 100) : 0;
  if (pct >= 80) Sound.win(); else Sound.next();
  const cls   = pct >= 80 ? 'great' : pct >= 50 ? 'ok' : 'low';
  const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';
  const msg   = pct >= 80 ? 'Отлично!' : pct >= 50 ? 'Хорошо!' : 'Попробуй ещё!';

  el.innerHTML = `
    <div class="player-topbar"></div>
    <div class="player-body">
      <div class="player-card result-screen">
        <div style="font-size:52px;margin-bottom:8px">${emoji}</div>
        <div class="result-score ${cls}">${pct}%</div>
        <div class="result-label">${msg} Правильно ${correct} из ${total}</div>
        <div style="display:flex;gap:12px;justify-content:center">
          <button class="btn btn-ghost" id="result-close-btn">Закрыть</button>
        </div>
      </div>
    </div>`;
  el.querySelector('#result-close-btn').addEventListener('click', () => Player.close());
}

// Единая функция результата для новых типов (PlayerTypes._showResult)
// Параметр onRetry — функция для «Ещё раз», null — без повтора
function _playerShowResult(el, player, correct, total, durationSec, onRetry) {
  const pct   = total > 0 ? Math.round(correct / total * 100) : 0;
  // Звук победы
  if (pct >= 80) Sound.win(); else Sound.next();
  const cls   = pct >= 80 ? 'great' : pct >= 50 ? 'ok' : 'low';
  const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';
  const msg   = pct >= 80 ? 'Отлично!' : pct >= 50 ? 'Хорошо!' : 'Попробуй ещё!';
  const mins  = Math.floor(durationSec / 60);
  const secs  = durationSec % 60;
  const dur   = mins > 0 ? `${mins} мин ${secs} с` : `${secs} с`;

  el.innerHTML = `
    <div class="player-topbar"></div>
    <div class="player-body">
      <div class="player-card result-screen">
        <div style="font-size:52px;margin-bottom:8px">${emoji}</div>
        <div class="result-score ${cls}">${pct}%</div>
        <div class="result-label">${msg} Правильно ${correct} из ${total}</div>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:20px">Время: ${dur}</div>
        <div style="display:flex;gap:12px;justify-content:center">
          ${onRetry ? `<button class="btn btn-ghost" id="result-retry-btn">Ещё раз</button>` : ''}
          <button class="btn btn-primary" id="result-close-btn">Закрыть</button>
        </div>
      </div>
    </div>`;
  el.querySelector('#result-close-btn').addEventListener('click', () => player.close());
  el.querySelector('#result-retry-btn')?.addEventListener('click', onRetry);
}

// ── Загрузка изображений ──────────────────────────────────────────────────────
async function loadPlayerImages(container) {
  const imgs = container.querySelectorAll('img[data-path]');
  for (const img of imgs) {
    if (!img.src || img.src === window.location.href) {
      const d = await window.db.files.getImageData(img.dataset.path);
      if (d) img.src = d;
    }
  }
}

// ── Линии соединения для упражнения «Сопоставление» ──────────────────────────
// arenaSelector — CSS-селектор контейнера с position:relative (по умолчанию #vm-arena)
function _drawMatchLines(el, leftItems, rightItems, matched, arenaSelector) {
  const sel   = arenaSelector || '#vm-arena';
  const arena = el.querySelector(sel);
  if (!arena) return;

  arena.querySelector('.vm-lines-svg')?.remove();

  const matchedEntries = Object.entries(matched);
  if (!matchedEntries.length) return;

  const arenaRect = arena.getBoundingClientRect();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('vm-lines-svg');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:10';
  svg.setAttribute('width', arenaRect.width);
  svg.setAttribute('height', arenaRect.height);

  matchedEntries.forEach(([leftIdx, rightIdx]) => {
    const leftCard  = el.querySelector(`[data-left="${leftIdx}"]`);
    const rightCard = el.querySelector(`[data-right="${rightIdx}"]`);
    if (!leftCard || !rightCard) return;

    const lr = leftCard.getBoundingClientRect();
    const rr = rightCard.getBoundingClientRect();

    const x1 = lr.right  - arenaRect.left;
    const y1 = lr.top    - arenaRect.top  + lr.height / 2;
    const x2 = rr.left   - arenaRect.left;
    const y2 = rr.top    - arenaRect.top  + rr.height / 2;
    const cx = (x1 + x2) / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--green)');
    path.setAttribute('stroke-width', '3.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', '0.85');
    svg.appendChild(path);
  });

  arena.appendChild(svg);
}

// ══════════════════════════════════════════════════════════════════════════════
const PlayerTypes = {

  // ── Visual Match — два столбца, соединение нажатием ─────────────────────────
  async visualMatch(ex, content, studentId, player) {
    const items = content.items || [];
    if (items.length < 2) {
      player._el.innerHTML = `
        <div class="player-topbar"><button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button></div>
        <div class="player-body"><div class="player-card" style="text-align:center">
          <div style="font-size:18px;color:var(--text-3)">Нужно минимум 2 пары — откройте редактор и добавьте их.</div>
        </div></div>`;
      bindCloseBtn(player._el);
      return;
    }

    const el        = player._el;
    const startTime = Date.now();

    const leftItems  = items.map((item, i) => ({ ...item, idx: i }));
    const rightItems = [...items.map((item, i) => ({ ...item, idx: i }))]
      .sort(() => Math.random() - .5);
    let attempts = 0;
    while (rightItems.some((r, i) => r.idx === i) && attempts < 20) {
      rightItems.sort(() => Math.random() - .5);
      attempts++;
    }

    const matched          = {};        // leftIdx → rightIdx
    const firstAttemptFail = new Set(); // leftIdx, где была ошибка до верного ответа
    let selectedRight = null;

    async function tryMatch(leftIdx, rightIdx) {
      if (matched[leftIdx] !== undefined) return;
      if (Object.values(matched).map(Number).includes(rightIdx)) return;
      const isCorrect = leftIdx === rightIdx;
      if (isCorrect) {
        matched[leftIdx] = rightIdx;
        selectedRight = null;
        Sound.success();
        await render();
        const done = Object.keys(matched).length;
        if (done === items.length) {
          const correctCount = items.length - firstAttemptFail.size;
          const dur = Math.round((Date.now() - startTime) / 1000);
          player._saveResult(studentId, ex.id, correctCount, items.length, matched, dur);
          setTimeout(() => {
            PlayerTypes._showResult(el, player, correctCount, items.length, dur, async () => {
              Object.keys(matched).forEach(k => delete matched[k]);
              firstAttemptFail.clear(); selectedRight = null;
              rightItems.sort(() => Math.random() - .5);
              await render();
            });
          }, 500);
        }
      } else {
        firstAttemptFail.add(leftIdx); // ошибка — этот левый теперь не идёт в зачёт
        Sound.error();
        const slot = el.querySelector(`[data-left="${leftIdx}"]`);
        const chip = el.querySelector(`[data-right="${rightIdx}"]`);
        slot?.classList.add('wrong'); chip?.classList.add('wrong');
        setTimeout(() => { slot?.classList.remove('wrong'); chip?.classList.remove('wrong'); }, 700);
      }
    }

    const THUMB = 'width:100px;height:100px;object-fit:cover;border-radius:10px;flex-shrink:0';
    const THUMB_CONTAIN = 'width:100px;height:100px;object-fit:contain;border-radius:10px;flex-shrink:0;background:var(--surface-2)';

    const render = async () => {
      const done  = Object.keys(matched).length;
      const total = items.length;
      const pct   = Math.round(done / total * 100);
      const unmatchedRight = rightItems.filter(r => !Object.values(matched).map(Number).includes(r.idx));
      const hasImages = items.some(i => i.question_img || i.answer_img);
      const IMG_H = '180px'; // высота блока картинки в карточке

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button>
          <div style="font-size:14px;font-weight:600;color:var(--text-2);flex-shrink:0">${escHtml(ex.name)}</div>
          <div class="player-progress-bar"><div class="player-progress-fill" style="width:${pct}%"></div></div>
          <div class="player-counter">${done} / ${total}</div>
        </div>
        <div class="player-body" style="overflow-y:auto;padding:20px 24px">
          <div style="width:100%;max-width:900px">

            <div style="font-family:var(--font-title);font-size:17px;text-align:center;margin-bottom:16px;color:var(--text-1)">
              ${done === total ? 'Всё верно!' : selectedRight !== null ? 'Выбери вопрос слева' : 'Перетащи ответ на нужный вопрос'}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">

              <!-- Левый: вопросы-слоты, вертикальные карточки -->
              <div style="display:flex;flex-direction:column;gap:10px">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">Вопросы</div>
                ${leftItems.map(item => {
                  const matchedRIdx = matched[item.idx];
                  const isMatched   = matchedRIdx !== undefined;
                  const hadError    = firstAttemptFail.has(item.idx);
                  const matchedR    = isMatched ? rightItems.find(r => r.idx === +matchedRIdx) : null;
                  return `
                    <div class="match-item vm-slot ${isMatched ? 'matched' : ''}" data-left="${item.idx}"
                      style="display:flex;flex-direction:column;overflow:hidden;padding:0;
                        ${!isMatched ? 'border:2px dashed var(--border-2);cursor:pointer' : ''}
                        ${hadError && isMatched ? 'border-color:var(--amber)!important;background:var(--amber-l,#FFFBEB)!important' : ''}">
                      ${item.question_img
                        ? `<div style="width:100%;height:${IMG_H};background:var(--surface-2);overflow:hidden;flex-shrink:0">
                            <img data-path="${escHtml(item.question_img)}" style="width:100%;height:100%;object-fit:contain">
                          </div>`
                        : ''}
                      ${item.question
                        ? `<div style="padding:10px 12px;font-size:15px;font-weight:600;color:var(--text-1)">
                            ${escHtml(item.question)}</div>`
                        : ''}
                      ${isMatched
                        ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
                              background:${hadError?'var(--amber-l,#FFFBEB)':'var(--green-l)'};
                              border-top:1.5px solid ${hadError?'var(--amber)':'var(--green)'}">
                            ${matchedR?.answer_img
                              ? `<img data-path="${escHtml(matchedR.answer_img)}"
                                  style="height:40px;max-width:64px;object-fit:contain;border-radius:6px;flex-shrink:0">`
                              : ''}
                            ${matchedR?.answer
                              ? `<span style="font-size:13px;font-weight:700;color:${hadError?'var(--amber-600,#92400E)':'var(--green)'}">
                                  ${escHtml(matchedR.answer)}</span>`
                              : ''}
                            <span style="margin-left:auto;color:${hadError?'var(--amber)':'var(--green)'};font-size:16px">${hadError?'~':'✓'}</span>
                          </div>`
                        : `<div style="padding:10px 12px;color:var(--text-3);font-size:12px;text-align:center;
                              border-top:1px dashed var(--border-2)">перетащи ответ сюда ↓</div>`}
                    </div>`;
                }).join('')}
              </div>

              <!-- Правый: пул ответов, вертикальные карточки -->
              <div style="display:flex;flex-direction:column;gap:10px">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">Ответы</div>
                ${unmatchedRight.length === 0
                  ? `<div style="color:var(--text-3);font-size:13px;padding:20px 0;text-align:center">Все ответы размещены ✓</div>`
                  : unmatchedRight.map(item => `
                    <div class="match-item vm-chip ${selectedRight === item.idx ? 'selected' : ''}"
                      data-right="${item.idx}"
                      style="display:flex;flex-direction:column;overflow:hidden;padding:0;
                        cursor:grab;touch-action:none;user-select:none">
                      ${item.answer_img
                        ? `<div style="width:100%;height:${IMG_H};background:var(--surface-2);overflow:hidden;flex-shrink:0">
                            <img data-path="${escHtml(item.answer_img)}" style="width:100%;height:100%;object-fit:contain">
                          </div>`
                        : ''}
                      ${item.answer
                        ? `<div style="padding:10px 12px;font-size:15px;font-weight:600;color:var(--text-1)">
                            ${escHtml(item.answer)}</div>`
                        : ''}
                    </div>`).join('')}
              </div>
            </div>
          </div>
        </div>`;

      bindCloseBtn(el);
      await loadPlayerImages(el);
      if (done === total) return;

      el.querySelectorAll('.vm-chip[data-right]').forEach(chip => {
        const rightIdx = +chip.dataset.right;
        DnD.makeDraggable(chip, { data: { rightIdx }, onDragStart: () => { selectedRight = null; } });
        chip.addEventListener('click', () => {
          selectedRight = selectedRight === rightIdx ? null : rightIdx;
          render();
        });
      });

      el.querySelectorAll('.vm-slot[data-left]').forEach(slot => {
        const leftIdx = +slot.dataset.left;
        if (matched[leftIdx] !== undefined) return;
        DnD.makeDropTarget(slot, { onDrop: ({ rightIdx }) => tryMatch(leftIdx, rightIdx) });
        slot.addEventListener('click', () => { if (selectedRight !== null) tryMatch(leftIdx, selectedRight); });
      });
    };

    await render();
  },

  // ── Find Pairs ──────────────────────────────────────────────────────────────
  memory_game(ex, content, studentId, player) {
    const pairs = content.pairs || [];
    if (!pairs.length) {
      player._el.innerHTML = `
        <div class="player-topbar"><button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button></div>
        <div class="player-body"><div class="player-card" style="text-align:center">
          <div style="font-size:18px;color:var(--text-3)">Упражнение пусто.</div>
        </div></div>`;
      bindCloseBtn(player._el);
      return;
    }

    const cards = [];
    pairs.forEach((p, i) => {
      cards.push({ id: cards.length, pair_id: i, text: p.a_text, img: p.a_img });
      cards.push({ id: cards.length, pair_id: i, text: p.b_text, img: p.b_img });
    });
    cards.sort(() => Math.random() - .5);

    let flipped = [], matched = new Set(), locked = false;
    let correct = 0;
    const startTime = Date.now();

    async function render() {
      if (!player._el) return;
      player._el.innerHTML = playerTopbar(ex.name, matched.size / 2, pairs.length) + `
        <div class="player-body">
          <div class="player-card">
            <div style="font-family:var(--font-title);font-size:18px;text-align:center;margin-bottom:24px">Найди все пары (Мемо)</div>
            <div class="pairs-grid">
              ${cards.map(c => `
                <div class="pair-card ${matched.has(c.id) ? 'matched' : ''}" data-id="${c.id}">
                  ${matched.has(c.id)
                    ? (c.img ? `<img data-path="${escHtml(c.img)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : escHtml(c.text || '✓'))
                    : `<span style="font-size:22px;color:var(--text-3)">?</span>`}
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      bindCloseBtn(player._el);
      if (!player._el) return;
      await loadPlayerImages(player._el);
      if (!player._el) return;

      player._el.querySelectorAll('.pair-card:not(.matched)').forEach(card => {
        card.addEventListener('click', async () => {
          if (locked || flipped.length >= 2) return;
          const cid      = +card.dataset.id;
          if (flipped.includes(cid)) return;

          flipped.push(cid);
          const cardData = cards.find(c => c.id === cid);
          card.classList.add('flipped');
          card.innerHTML = cardData.img
            ? `<img data-path="${escHtml(cardData.img)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`
            : `<span style="font-size:15px;font-weight:600">${escHtml(cardData.text || '')}</span>`;
          await loadPlayerImages(card.parentElement);
          if (!player._el) return;

          if (flipped.length === 2) {
            locked       = true;
            const [id1, id2] = flipped;
            const c1     = cards.find(c => c.id === id1);
            const c2     = cards.find(c => c.id === id2);
            const isMatch = c1.pair_id === c2.pair_id;

            if (isMatch) {
              matched.add(id1); matched.add(id2);
              Sound.match();
              correct++;
              flipped = []; locked = false;
              if (matched.size === cards.length) {
                const dur = Math.round((Date.now() - startTime) / 1000);
                player._saveResult(studentId, ex.id, correct, pairs.length, [], dur);
                setTimeout(() => {
                  PlayerTypes._showResult(player._el, player, correct, pairs.length, dur, () => {
                    // Сброс для повторного прохождения
                    matched.clear(); flipped = []; locked = false; correct = 0;
                    cards.sort(() => Math.random() - .5);
                    render();
                  });
                }, 400);
              } else {
                render();
              }
            } else {
              player._el.querySelectorAll('.pair-card.flipped:not(.matched)').forEach(c => c.classList.add('wrong-flash'));
              setTimeout(() => { flipped = []; locked = false; render(); }, 1000);
            }
          }
        });
      });
    }

    render();
  },

  // ── Найди пару (find_pairs) — два столбца, линии как в visual_match ────────
  async findPairs(ex, content, studentId, player) {
    const pairs = content.pairs || [];
    if (!pairs.length) {
      player._el.innerHTML = `
        <div class="player-topbar"><button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button></div>
        <div class="player-body"><div class="player-card" style="text-align:center">
          <div style="font-size:18px;color:var(--text-3)">Упражнение пусто.</div>
        </div></div>`;
      bindCloseBtn(player._el);
      return;
    }

    const el        = player._el;
    const startTime = Date.now();

    // Левый столбец — в порядке добавления, правый — перемешан
    const leftItems  = pairs.map((p, i) => ({ idx: i, text: p.a_text, img: p.a_img }));
    const rightItems = pairs.map((p, i) => ({ idx: i, text: p.b_text, img: p.b_img }))
                            .sort(() => Math.random() - .5);

    // Гарантируем, что ни один правый не стоит напротив своего левого
    let attempts = 0;
    while (rightItems.some((r, i) => r.idx === i) && attempts < 20) {
      rightItems.sort(() => Math.random() - .5);
      attempts++;
    }

    let selectedLeft = null;   // idx выбранного левого объекта
    const matched    = {};     // leftIdx → rightIdx
    const errors     = {};     // rightIdx → true (мигание ошибки)
    const firstAttemptFail = new Set(); // leftIdx с ошибкой до верного соединения

    const render = async () => {
      const total = pairs.length;
      const done  = Object.keys(matched).length;
      const pct   = Math.round(done / total * 100);

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button>
          <div style="font-size:14px;font-weight:600;color:var(--text-2);flex-shrink:0">${escHtml(ex.name)}</div>
          <div class="player-progress-bar">
            <div class="player-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="player-counter">${done} / ${total}</div>
        </div>
        <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:32px 48px">
          <div style="width:100%;max-width:900px">
            <div style="font-family:var(--font-title);font-size:20px;text-align:center;
              margin-bottom:24px;color:var(--text-1)">
              ${selectedLeft !== null
                ? 'Теперь выбери пару справа'
                : done === total ? 'Все пары найдены!' : 'Выбери объект слева'}
            </div>
            <div style="position:relative" id="fp2-arena">
              <div style="display:grid;grid-template-columns:1fr 48px 1fr;gap:0 16px">
                <!-- Левый столбец -->
                <div style="display:flex;flex-direction:column;gap:12px">
                  ${leftItems.map(item => {
                    const isMatched  = matched[item.idx] !== undefined;
                    const isSelected = selectedLeft === item.idx;
                    return `
                      <div class="match-item ${isMatched ? 'matched' : isSelected ? 'selected' : ''}"
                        data-left="${item.idx}" style="min-height:80px">
                        ${item.img
                          ? `<img data-path="${escHtml(item.img)}" style="width:100%;max-height:130px;object-fit:contain;border-radius:10px">`
                          : ''}
                        ${item.text
                          ? `<div class="mi-label">${escHtml(item.text)}</div>`
                          : ''}
                      </div>`;
                  }).join('')}
                </div>
                <!-- Центр (SVG линии) -->
                <div style="position:relative"></div>
                <!-- Правый столбец -->
                <div style="display:flex;flex-direction:column;gap:12px">
                  ${rightItems.map(item => {
                    const isMatched = Object.entries(matched).some(([l, r]) => +r === item.idx);
                    const isError   = errors[item.idx];
                    return `
                      <div class="match-item ${isMatched ? 'matched' : ''} ${isError ? 'wrong' : ''}"
                        data-right="${item.idx}" style="min-height:80px">
                        ${item.img
                          ? `<img data-path="${escHtml(item.img)}" style="width:100%;max-height:130px;object-fit:contain;border-radius:10px">`
                          : ''}
                        ${item.text
                          ? `<div class="mi-label">${escHtml(item.text)}</div>`
                          : ''}
                      </div>`;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>`;

      bindCloseBtn(el);
      await loadPlayerImages(el);
      _drawMatchLines(el, leftItems, rightItems, matched, '#fp2-arena');

      if (done === total) {
        const correctCount = total - firstAttemptFail.size;
        const dur = Math.round((Date.now() - startTime) / 1000);
        player._saveResult(studentId, ex.id, correctCount, total, matched, dur);
        setTimeout(() => {
          PlayerTypes._showResult(el, player, correctCount, total, dur, async () => {
            Object.keys(matched).forEach(k => delete matched[k]);
            firstAttemptFail.clear(); selectedLeft = null;
            rightItems.sort(() => Math.random() - .5);
            await render();
          });
        }, 700);
        return;
      }

      // Клик по левому объекту
      el.querySelectorAll('[data-left]').forEach(card => {
        card.addEventListener('click', () => {
          const idx = +card.dataset.left;
          if (matched[idx] !== undefined) return;
          selectedLeft = selectedLeft === idx ? null : idx;
          render();
        });
      });

      // Клик по правому объекту
      el.querySelectorAll('[data-right]').forEach(card => {
        card.addEventListener('click', async () => {
          if (selectedLeft === null) { toast('Сначала выбери объект слева', ''); return; }
          const rightIdx = +card.dataset.right;
          if (Object.values(matched).map(Number).includes(rightIdx)) return;

          const isCorrect = rightIdx === selectedLeft;
          if (isCorrect) {
            matched[selectedLeft] = rightIdx;
            Sound.success();
            selectedLeft = null;
            render();
          } else {
            firstAttemptFail.add(selectedLeft); // ошибка снижает итоговый счёт
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
  oddOneOut(ex, content, studentId, player) {
    const tasks = content.tasks || [];
    if (!tasks.length) {
      player._el.innerHTML = `
        <div class="player-topbar"><button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button></div>
        <div class="player-body"><div class="player-card" style="text-align:center">
          <div style="font-size:18px;color:var(--text-3)">Упражнение пусто.</div>
        </div></div>`;
      bindCloseBtn(player._el);
      return;
    }

    const shuffled  = [...tasks].sort(() => Math.random() - .5);
    let idx = 0, correct = 0;
    const startTime = Date.now();

    async function render() {
      if (!player._el) return;
      if (idx >= shuffled.length) {
        const dur = Math.round((Date.now() - startTime) / 1000);
        player._saveResult(studentId, ex.id, correct, shuffled.length, [], dur);
        showResult(player._el, correct, shuffled.length);
        return;
      }

      const task     = shuffled[idx];
      const oddItem  = task.items[task.odd_index ?? 0];
      const items    = [...task.items].sort(() => Math.random() - .5);

      player._el.innerHTML = playerTopbar(ex.name, idx, shuffled.length) + `
        <div class="player-body">
          <div class="player-card">
            <div class="player-question">Найди лишний предмет</div>
            <div class="player-options cols-2">
              ${items.map((it, i) => {
                const isOdd = it.text === oddItem?.text && it.img === oddItem?.img;
                return `<div class="player-opt" data-odd="${isOdd}">
                  ${it.img ? `<img data-path="${escHtml(it.img)}" style="object-fit:cover;border-radius:10px">` : ''}
                  ${it.text ? `<span>${escHtml(it.text)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;

      bindCloseBtn(player._el);
      if (!player._el) return;
      await loadPlayerImages(player._el);
      if (!player._el) return;

      player._el.querySelectorAll('.player-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          const isOdd = opt.dataset.odd === 'true';
          if (isOdd) Sound.success(); else Sound.error();
          opt.classList.add(isOdd ? 'correct' : 'wrong');
          if (!isOdd) {
            player._el.querySelectorAll('.player-opt').forEach(o => {
              if (o.dataset.odd === 'true') o.classList.add('correct');
            });
          } else {
            correct++;
          }
          player._el.querySelectorAll('.player-opt').forEach(o => o.classList.add('disabled'));
          setTimeout(() => { idx++; render(); }, 900);
        });
      });
    }

    render();
  },

  // ── Sorting ─────────────────────────────────────────────────────────────────
  async sorting(ex, content, studentId, player) {
    // Нормализуем категории: строки → объекты {name, img}
    const rawCats = content.categories || [];
    const cats = rawCats.map(c => typeof c === 'string' ? { name: c, img: '' } : c);
    const items = content.items || [];

    if (!cats.length || !items.length) {
      player._el.innerHTML = `
        <div class="player-topbar"><button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button></div>
        <div class="player-body"><div class="player-card" style="text-align:center">
          <div style="font-size:18px;color:var(--text-3)">Упражнение пусто.</div>
        </div></div>`;
      bindCloseBtn(player._el);
      return;
    }

    const el = player._el;
    const shuffledItems = [...items].sort(() => Math.random() - .5);
    const placed  = {};   // catName → [item, ...]
    cats.forEach(c => { placed[c.name] = []; });
    const wrongOnce = new Set(); // item-ссылки, которые хоть раз положили неверно
    const startTime = Date.now();

    const render = async () => {
      const totalPlaced = Object.values(placed).reduce((s, a) => s + a.length, 0);
      const isDone = totalPlaced === shuffledItems.length;

      el.innerHTML = playerTopbar(ex.name, totalPlaced, shuffledItems.length) + `
        <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:28px 48px">
          <div style="width:100%;max-width:960px">
            <div style="font-family:var(--font-title);font-size:20px;text-align:center;margin-bottom:24px">
              Разложи по корзинам
            </div>

            <!-- Пул элементов -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;min-height:70px;
              padding:14px;background:var(--surface-2);border-radius:var(--r-xl);
              border:2px dashed var(--border-2);margin-bottom:24px" id="sort-pool">
              ${shuffledItems.filter(it => !Object.values(placed).flat().includes(it)).map((it, i) => `
                <div class="sort-chip-v2" data-pool-i="${i}">
                  ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:120px;height:120px;object-fit:cover;border-radius:var(--r-md)">` : ''}
                  ${it.text ? `<div class="sc-label">${escHtml(it.text)}</div>` : ''}
                </div>`).join('')
              || '<div style="color:var(--text-3);font-size:13px;margin:auto">Все распределены ✓</div>'}
            </div>

            <!-- Корзины -->
            <div style="display:grid;grid-template-columns:repeat(${Math.min(cats.length, 3)},1fr);gap:16px">
              ${cats.map(cat => `
                <div class="sort-bucket-v2" data-bucket="${escHtml(cat.name)}">
                  <div class="sb-header">
                    ${cat.img
                      ? `<img data-path="${escHtml(cat.img)}" class="sb-img">`
                      : ''}
                    <div class="sb-title">${escHtml(cat.name)}</div>
                  </div>
                  <div class="sb-items">
                    ${(placed[cat.name] || []).map(it => `
                      <div class="sort-chip-v2 placed-chip" data-placed-cat="${escHtml(cat.name)}"
                        style="cursor:pointer">
                        ${it.img ? `<img data-path="${escHtml(it.img)}" style="width:76px;height:76px;object-fit:cover;border-radius:var(--r-sm)">` : ''}
                        ${it.text ? `<div class="sc-label">${escHtml(it.text)}</div>` : ''}
                      </div>`).join('')}
                  </div>
                </div>`).join('')}
            </div>

            ${isDone ? `
              <div style="text-align:center;margin-top:28px">
                <button class="btn btn-primary btn-lg" id="sort-finish-btn"
                  style="padding:16px 48px;font-size:17px">
                  Проверить ✓
                </button>
              </div>` : ''}
          </div>
        </div>`;

      bindCloseBtn(el);
      await loadPlayerImages(el);

      // ── Состояние выбора (тап-вариант без DnD) ───────────────────────────
      let selected = null; // {item, srcCat} — выбранный элемент

      const pool = el.querySelector('#sort-pool');
      const poolItems = shuffledItems.filter(it => !Object.values(placed).flat().includes(it));

      // Тап на элемент в пуле — выбираем
      el.querySelectorAll('.sort-chip-v2[data-pool-i]').forEach((chip, ci) => {
        const item = poolItems[ci];
        chip.addEventListener('click', () => {
          if (selected?.item === item) { selected = null; chip.classList.remove('selected'); render(); return; }
          el.querySelectorAll('.sort-chip-v2').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          selected = { item, srcCat: null };
        });
      });

      // Тап на размещённый элемент — возвращаем в пул
      el.querySelectorAll('.placed-chip').forEach(chip => {
        chip.addEventListener('click', e => {
          e.stopPropagation();
          const catName = chip.dataset.placedCat;
          const items_  = placed[catName];
          // Найдём элемент по содержимому (img/text)
          const imgPath = chip.querySelector('img')?.dataset?.path || '';
          const text    = chip.querySelector('.sc-label')?.textContent || '';
          const idx     = items_.findIndex(it =>
            (it.img === imgPath || (!it.img && !imgPath)) &&
            (it.text === text || (!it.text && !text))
          );
          if (idx !== -1) {
            const removed = items_.splice(idx, 1)[0];
            // Откат счётчика правильных
            if (removed.category === catName) correct = Math.max(0, correct - 1);
            render();
          }
        });
      });

      // ── DnD ──────────────────────────────────────────────────────────────
      el.querySelectorAll('.sort-chip-v2[data-pool-i]').forEach((chip, ci) => {
        const item = poolItems[ci];
        DnD.makeDraggable(chip, {
          data: { item, srcCat: null },
          onDragStart: () => { selected = null; },
        });
      });

      el.querySelectorAll('.sort-bucket-v2').forEach(bucket => {
        const catName = bucket.dataset.bucket;

        // DnD drop
        DnD.makeDropTarget(bucket, {
          onDrop: (data) => {
            const { item, srcCat } = data;
            if (srcCat) placed[srcCat] = placed[srcCat].filter(it => it !== item);
            placed[catName].push(item);
            if (item.category !== catName) wrongOnce.add(item); // неверная корзина — фиксируем ошибку
            DnD.cleanup(el);
            render();
          },
        });

        // Тап — размещаем выбранный
        bucket.addEventListener('click', () => {
          if (!selected) return;
          const { item, srcCat } = selected;
          if (srcCat) placed[srcCat] = placed[srcCat].filter(it => it !== item);
          placed[catName].push(item);
          if (item.category !== catName) wrongOnce.add(item);
          selected = null;
          render();
        });
      });

      el.querySelector('#sort-finish-btn')?.addEventListener('click', () => {
        const correct = shuffledItems.filter(it => !wrongOnce.has(it) && it.category === Object.keys(placed).find(k => placed[k].includes(it))).length;
        const dur = Math.round((Date.now() - startTime) / 1000);
        player._saveResult(studentId, ex.id, correct, shuffledItems.length, placed, dur);
        PlayerTypes._showResult(el, player, correct, shuffledItems.length, dur, async () => {
          cats.forEach(c => { placed[c.name] = []; });
          wrongOnce.clear();
          shuffledItems.sort(() => Math.random() - .5);
          await render();
        });
      });
    };

    await render();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  ПЛЕЕРЫ НОВЫХ ТИПОВ
// ══════════════════════════════════════════════════════════════════════════════

Object.assign(PlayerTypes, {

  // ── Служебный: показ результата ───────────────────────────────────────────
  _showResult(el, player, correct, total, durationSec, onRetry) {
    _playerShowResult(el, player, correct, total, durationSec, onRetry);
  },

  // ── 5. Последовательность ─────────────────────────────────────────────────
  async sequencing(ex, content, studentId, player) {
    // Normalize: editor saves image/text, player uses img/label
    const items = (content.items || []).map(it => ({
      ...it,
      img:   it.img   || it.image || '',
      label: it.label || it.text  || '',
    }));
    if (items.length < 2) { player.close(); toast('Нужно минимум 2 элемента', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let order = [...Array(items.length).keys()];
    for (let i = order.length-1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let selected = []; // индексы в порядке нажатия

    const render = async () => {
      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="seq-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
        </div>
        <div class="player-body" style="overflow-y:auto">
          <div class="player-card" style="max-width:840px;width:100%">
            <div class="player-question" style="font-size:15px;margin-bottom:20px">
              ${escHtml(content.instruction || 'Расставь в правильном порядке')}
            </div>

            <!-- Слоты ответа (drop target) -->
            <div id="seq-answer-zone" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;
              margin-bottom:20px;min-height:96px;background:var(--surface-2);border-radius:var(--r-lg);
              padding:10px;border:2px dashed var(--border-2)">
              ${selected.map((origIdx, pos) => {
                const item = items[origIdx];
                return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer"
                  class="seq-placed" data-pos="${pos}" data-orig="${origIdx}">
                  <div style="width:150px;height:150px;border-radius:var(--r-lg);overflow:hidden;background:var(--indigo-l);
                    display:flex;align-items:center;justify-content:center;border:2px solid var(--indigo);position:relative">
                    ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                      : `<span style="font-size:13px;font-weight:600;color:var(--indigo);text-align:center;padding:6px">${escHtml(item.label)}</span>`}
                    <div style="position:absolute;top:2px;left:2px;background:var(--indigo);color:#fff;
                      width:20px;height:20px;border-radius:50%;font-size:10px;font-weight:700;
                      display:flex;align-items:center;justify-content:center">${pos+1}</div>
                  </div>
                  ${item.label ? `<div style="font-size:11px;color:var(--indigo);font-weight:500;max-width:80px;text-align:center">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('') || '<div style="color:var(--text-3);font-size:13px;margin:auto">Перетащи или нажимай на элементы ниже</div>'}
            </div>

            <!-- Варианты (pool) -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:20px">
              ${order.map((origIdx, pos) => {
                const item = items[origIdx];
                const isPlaced = selected.includes(origIdx);
                return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;
                  cursor:${isPlaced?'default':'grab'};opacity:${isPlaced?.25:1};transition:opacity .2s"
                  class="${isPlaced?'seq-placed-ghost':'seq-opt'}" data-orig="${origIdx}">
                  <div style="width:150px;height:150px;border-radius:var(--r-lg);overflow:hidden;background:var(--surface);
                    border:2px solid var(--border);display:flex;align-items:center;justify-content:center">
                    ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                      : `<span style="font-size:13px;font-weight:500;color:var(--text-2);text-align:center;padding:6px">${escHtml(item.label)}</span>`}
                  </div>
                  ${item.label ? `<div style="font-size:11px;color:var(--text-3);max-width:80px;text-align:center">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>

            <div style="display:flex;gap:10px;justify-content:center">
              ${selected.length > 0 ? `<button class="btn btn-ghost" id="seq-undo">↩ Убрать последний</button>` : ''}
              ${selected.length === items.length ? `<button class="btn btn-primary" id="seq-check">Проверить →</button>` : ''}
            </div>
          </div>
        </div>`;

      await loadLazyImages(el);
      el.querySelector('#seq-close').addEventListener('click', () => player.close());

      // Тап по элементу из пула — добавить в selected
      el.querySelectorAll('.seq-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          selected.push(+opt.dataset.orig);
          render();
        });
      });
      // Тап по размещённому — убрать
      el.querySelectorAll('.seq-placed').forEach(p => {
        p.addEventListener('click', () => {
          selected.splice(+p.dataset.pos, 1);
          render();
        });
      });
      el.querySelector('#seq-undo')?.addEventListener('click', () => { selected.pop(); render(); });
      el.querySelector('#seq-check')?.addEventListener('click', () => {
        const allCorrect = selected.every((origIdx, pos) => origIdx === pos);
        if (allCorrect) Sound.win(); else Sound.error();
        const correct = allCorrect ? 1 : 0;
        const duration = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, 1, selected, duration);
        PlayerTypes._showResult(el, player, correct, 1, duration, async () => {
          selected = []; render();
        });
      });

      // ── DnD: тащить из пула в зону ответа ─────────────────────────────────
      el.querySelectorAll('.seq-opt[data-orig]').forEach(chip => {
        DnD.makeDraggable(chip, {
          data: { origIdx: +chip.dataset.orig },
        });
      });

      const answerZone = el.querySelector('#seq-answer-zone');
      if (answerZone) {
        DnD.makeDropTarget(answerZone, {
          onDrop: ({ origIdx }) => {
            if (!selected.includes(origIdx)) {
              selected.push(origIdx);
              DnD.cleanup(el);
              render();
            }
          },
        });
      }

      // DnD: тащить размещённый элемент — переставить (swap с другим местом)
      el.querySelectorAll('.seq-placed[data-pos]').forEach(placed => {
        const pos = +placed.dataset.pos;
        DnD.makeDraggable(placed, { data: { placedPos: pos } });
        DnD.makeDropTarget(placed, {
          onDrop: ({ placedPos: fromPos }) => {
            if (fromPos === undefined || fromPos === pos) return;
            [selected[fromPos], selected[pos]] = [selected[pos], selected[fromPos]];
            DnD.cleanup(el);
            render();
          },
        });
      });
    };
    await render();
  },

  // ── 6. Память ─────────────────────────────────────────────────────────────
  async memory(ex, content, studentId, player) {
    const pairs = content.pairs || [];
    if (pairs.length < 2) { player.close(); toast('Нужно минимум 2 пары', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();

    // Создаём дублированный перемешанный массив карточек
    let cards = [...pairs.map((p,i) => ({...p, pairId:i})), ...pairs.map((p,i) => ({...p, pairId:i}))];
    for (let i = cards.length-1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards = cards.map((c, idx) => ({...c, cardIdx: idx, flipped: false, matched: false}));

    let flippedCards = [];
    let locked = false;
    let moves = 0;

    const render = async () => {
      const cols = Math.ceil(Math.sqrt(cards.length * 1.2));
      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="mem-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          <div style="font-size:13px;color:var(--text-3);margin-left:auto">Ходов: ${moves}</div>
        </div>
        <div class="player-body" style="overflow-y:auto;padding:20px">
          <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;max-width:720px;width:100%">
            ${cards.map(c => `
              <div class="mem-card ${c.flipped||c.matched?'flipped':''} ${c.matched?'matched':''}"
                data-idx="${c.cardIdx}"
                style="aspect-ratio:1;border-radius:var(--r-lg);cursor:${c.matched||locked?'default':'pointer'};
                  perspective:600px;position:relative;transition:transform .15s">
                <div style="width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .35s;
                  transform:${c.flipped||c.matched?'rotateY(180deg)':'none'}">
                  <!-- Рубашка -->
                  <div style="position:absolute;inset:0;backface-visibility:hidden;
                    background:linear-gradient(135deg,var(--indigo) 0%,#7C3AED 100%);border-radius:var(--r-lg);
                    display:flex;align-items:center;justify-content:center;font-size:24px">🎴</div>
                  <!-- Лицо -->
                  <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);
                    background:${c.matched?'var(--green-l)':'var(--surface)'};border-radius:var(--r-lg);
                    border:2px solid ${c.matched?'var(--green)':'var(--indigo)'};
                    display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;overflow:hidden">
                    ${c.img ? `<img src="" data-path="${escHtml(c.img)}" class="lazy-img"
                      style="width:100%;flex:1;object-fit:cover;border-radius:6px">`
                      : `<span style="font-size:13px;font-weight:600;color:var(--indigo);text-align:center;line-height:1.3">${escHtml(c.label)}</span>`}
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>`;

      await loadLazyImages(el);
      el.querySelector('#mem-close').addEventListener('click', () => player.close());

      el.querySelectorAll('.mem-card').forEach(card => {
        card.addEventListener('click', () => {
          if (locked) return;
          const idx  = +card.dataset.idx;
          const c    = cards[idx];
          if (c.matched || c.flipped) return;

          c.flipped = true;
          flippedCards.push(c);

          if (flippedCards.length === 2) {
            locked = true;
            moves++;
            const [a, b] = flippedCards;
            if (a.pairId === b.pairId) {
              a.matched = b.matched = true;
              flippedCards = [];
              locked = false;
              render();
              // Проверяем победу
              if (cards.every(c => c.matched)) {
                const duration = Math.round((Date.now()-startTime)/1000);
                player._saveResult(studentId, ex.id, pairs.length, pairs.length, [], duration);
                setTimeout(() => PlayerTypes._showResult(el, player, pairs.length, pairs.length, duration, null), 600);
              }
            } else {
              render();
              setTimeout(() => {
                a.flipped = b.flipped = false;
                flippedCards = [];
                locked = false;
                render();
              }, 900);
            }
          } else {
            render();
          }
        });
      });
    };
    await render();
  },

  // ── 7. Что исчезло? ───────────────────────────────────────────────────────
  async whats_missing(ex, content, studentId, player) {
    const items = content.items || [];
    if (items.length < 3) { player.close(); toast('Нужно минимум 3 предмета', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let phase = 'show'; // show → hide → answer
    let missingIdx = Math.floor(Math.random() * items.length);
    let selected = null;
    let correct = 0, total = 1;

    const render = async () => {
      if (phase === 'show') {
        let timer = content.showTime || 4;
        el.innerHTML = `
          <div class="player-topbar">
            <button class="btn btn-ghost btn-sm" id="wm-close">Закрыть</button>
            <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
            <div style="margin-left:auto;font-size:20px;font-weight:700;color:var(--indigo)" id="wm-timer">${timer}</div>
          </div>
          <div class="player-body">
            <div class="player-card" style="max-width:660px">
              <div class="player-question">Запомни все предметы!</div>
              <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:8px">
                ${items.map(item => `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
                    <div style="width:140px;height:180px;border-radius:var(--r-lg);overflow:hidden;
                      background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center">
                      ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                        : `<span style="font-size:13px;font-weight:600;color:var(--text-2);text-align:center;padding:4px">${escHtml(item.label)}</span>`}
                    </div>
                    ${item.label ? `<div style="font-size:11px;color:var(--text-3);max-width:84px;text-align:center">${escHtml(item.label)}</div>` : ''}
                  </div>`).join('')}
              </div>
            </div>
          </div>`;

        await loadLazyImages(el);
        el.querySelector('#wm-close').addEventListener('click', () => player.close());

        const interval = setInterval(() => {
          timer--;
          const timerEl = document.getElementById('wm-timer');
          if (timerEl) timerEl.textContent = timer;
          if (timer <= 0) {
            clearInterval(interval);
            phase = 'hide';
            render();
          }
        }, 1000);

      } else if (phase === 'hide') {
        const visible = items.filter((_, i) => i !== missingIdx);
        el.innerHTML = `
          <div class="player-topbar">
            <button class="btn btn-ghost btn-sm" id="wm-close2">Закрыть</button>
            <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          </div>
          <div class="player-body">
            <div class="player-card" style="max-width:660px">
              <div class="player-question">Какого предмета не хватает?</div>
              <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:24px">
                ${visible.map(item => `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
                    <div style="width:140px;height:180px;border-radius:var(--r-lg);overflow:hidden;
                      background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center">
                      ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                        : `<span style="font-size:13px;font-weight:600;color:var(--text-2);text-align:center;padding:4px">${escHtml(item.label)}</span>`}
                    </div>
                    ${item.label ? `<div style="font-size:11px;color:var(--text-3);max-width:84px;text-align:center">${escHtml(item.label)}</div>` : ''}
                  </div>`).join('')}
                <!-- Пустое место -->
                <div style="width:140px;height:180px;border-radius:var(--r-lg);border:3px dashed var(--indigo);
                  display:flex;align-items:center;justify-content:center;font-size:28px">❓</div>
              </div>
              <div style="font-size:13px;color:var(--text-3);text-align:center;margin-bottom:14px">Выбери исчезнувший предмет:</div>
              <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
                ${items.map((item, i) => `
                  <div class="wm-answer" data-i="${i}"
                    style="padding:10px 20px;border-radius:var(--r-md);border:2px solid var(--border);
                      cursor:pointer;font-size:14px;font-weight:500;background:var(--surface);transition:all .15s">
                    ${item.label || (i+1)}
                  </div>`).join('')}
              </div>
            </div>
          </div>`;

        await loadLazyImages(el);
        el.querySelector('#wm-close2').addEventListener('click', () => player.close());
        el.querySelectorAll('.wm-answer').forEach(btn => {
          btn.addEventListener('click', () => {
            selected = +btn.dataset.i;
            correct = selected === missingIdx ? 1 : 0;
            phase = 'answer';
            render();
          });
        });

      } else {
        const duration = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, total, { selected, missing: missingIdx }, duration);
        PlayerTypes._showResult(el, player, correct, total, duration, async () => {
          // Новый раунд
          missingIdx = Math.floor(Math.random() * items.length);
          selected = null; correct = 0; phase = 'show';
          render();
        });
      }
    };
    await render();
  },

  // ── 8. Считаем ────────────────────────────────────────────────────────────
  async counting(ex, content, studentId, player) {
    const tasks = content.tasks || [];
    if (!tasks.length) { player.close(); toast('Нет заданий', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let taskIdx = 0, correct = 0;

    const renderTask = async () => {
      if (taskIdx >= tasks.length) {
        const duration = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, tasks.length, {}, duration);
        PlayerTypes._showResult(el, player, correct, tasks.length, duration, null);
        return;
      }
      const task = tasks[taskIdx];
      const minO = task.minOpt ?? 0, maxO = task.maxOpt ?? 5;
      const opts = [];
      for (let n = minO; n <= maxO; n++) opts.push(n);
      // Гарантируем правильный ответ в списке
      if (!opts.includes(task.answer)) opts.push(task.answer);
      opts.sort((a,b)=>a-b);

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="cnt-close">Закрыть</button>
          <div class="player-progress-bar">
            <div class="player-progress-fill" style="width:${taskIdx/tasks.length*100}%"></div>
          </div>
          <div class="player-counter">${taskIdx+1} / ${tasks.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:680px">
            <div class="player-question">${escHtml(task.question || 'Сколько предметов?')}</div>
            ${task.img ? `<div style="text-align:center;margin-bottom:20px">
              <img src="" data-path="${escHtml(task.img)}" class="lazy-img"
                style="max-height:280px;max-width:100%;object-fit:contain;border-radius:var(--r-lg)"></div>` : ''}
            <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">
              ${opts.map(n => `
                <div class="cnt-opt" data-n="${n}"
                  style="width:82px;height:82px;border-radius:var(--r-lg);border:2px solid var(--border);
                    cursor:pointer;font-size:30px;font-weight:700;color:var(--text-1);
                    display:flex;align-items:center;justify-content:center;
                    background:var(--surface);transition:all .15s">${n}</div>`).join('')}
            </div>
          </div>
        </div>`;

      await loadLazyImages(el);
      el.querySelector('#cnt-close').addEventListener('click', () => player.close());
      el.querySelectorAll('.cnt-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          const n = +opt.dataset.n;
          const isCorrect = n === task.answer;
          if (isCorrect) { Sound.success(); correct++; } else Sound.error();
          opt.style.background = isCorrect ? 'var(--green-l)' : 'var(--rose-l)';
          opt.style.borderColor = isCorrect ? 'var(--green)' : 'var(--rose)';
          opt.style.color       = isCorrect ? 'var(--green)' : 'var(--rose)';
          el.querySelectorAll('.cnt-opt').forEach(o => o.style.pointerEvents = 'none');
          // Показать правильный если ошибка
          if (!isCorrect) {
            const correctOpt = [...el.querySelectorAll('.cnt-opt')].find(o => +o.dataset.n === task.answer);
            if (correctOpt) { correctOpt.style.background = 'var(--green-l)'; correctOpt.style.borderColor = 'var(--green)'; }
          }
          setTimeout(() => { taskIdx++; renderTask(); }, 900);
        });
      });
    };
    await renderTask();
  },

  // ── 9. Разложи по группам ────────────────────────────────────────────────
  async categories(ex, content, studentId, player) {
    // Editor saves: content.groups=[{name,color}], content.items=[{text,image,group:idx}]
    // Legacy format:  content.categories=[{name, items:[...]}]
    // Normalize both to flat allItems with correctCat
    let cats, allItems;
    if (content.groups && content.items) {
      // New flat format from editor
      cats = content.groups;
      allItems = (content.items || []).map((it, i) => ({
        id:         i,
        label:      it.text  || it.label || '',
        img:        it.image || it.img   || '',
        correctCat: it.group ?? it.category ?? 0,
      }));
    } else {
      // Legacy nested format
      cats = content.categories || [];
      allItems = [];
      cats.forEach((cat, ci) => {
        (cat.items||[]).forEach(item => allItems.push({
          label:      item.label || item.text || '',
          img:        item.img   || item.image || '',
          correctCat: ci,
        }));
      });
      allItems.forEach((it, i) => it.id = i);
    }

    if (!cats.length || !allItems.length) { player.close(); toast('Нет элементов', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();

    // Перемешать
    for (let i = allItems.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    // Состояние: какой элемент в какой корзине
    const placed   = {}; // itemId -> catIdx
    const wrongOnce = new Set(); // itemId, которые хоть раз положили не в ту группу
    let selected = null; // выбранный для перетаскивания

    const render = async () => {
      const poolItems = allItems.filter(item => placed[item.id] === undefined);
      const isDone = poolItems.length === 0;
      const correctCount = isDone ? allItems.filter(item => placed[item.id] === item.correctCat).length : 0;

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="cat-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          ${isDone ? `<button class="btn btn-primary" id="cat-check" style="margin-left:auto">Проверить</button>` : ''}
        </div>
        <div class="player-body" style="overflow-y:auto;align-items:flex-start;padding:20px">
          <div style="width:100%;max-width:760px">

            <!-- Пул нераспределённых -->
            ${poolItems.length ? `
              <div style="background:var(--surface-2);border:2px dashed var(--border-2);border-radius:var(--r-xl);
                padding:14px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px;min-height:80px">
                ${poolItems.map(item => `
                  <div class="cat-pool-item ${selected===item.id?'selected':''}" data-id="${item.id}"
                    style="display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;
                      padding:8px;border-radius:var(--r-lg);border:2px solid ${selected===item.id?'var(--indigo)':'var(--border)'};
                      background:${selected===item.id?'var(--indigo-l)':'var(--surface)'};transition:all .15s;min-width:70px">
                    <div style="width:100px;height:100px;border-radius:var(--r-md);overflow:hidden;
                      background:var(--surface-2);display:flex;align-items:center;justify-content:center">
                      ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                        : `<span style="font-size:13px;font-weight:600;color:var(--text-2);text-align:center;padding:6px">${escHtml(item.label)}</span>`}
                    </div>
                    ${item.label && item.img ? `<div style="font-size:11px;color:var(--text-3);text-align:center;max-width:70px">${escHtml(item.label)}</div>` : ''}
                  </div>`).join('')}
              </div>` : ''}

            <!-- Корзины категорий -->
            <div style="display:grid;grid-template-columns:repeat(${cats.length},1fr);gap:12px">
              ${cats.map((cat, ci) => {
                const catItems = allItems.filter(item => placed[item.id] === ci);
                return `
                  <div class="cat-bucket" data-ci="${ci}"
                    style="border:2px solid var(--border);border-radius:var(--r-xl);
                      padding:12px;min-height:160px;background:var(--surface);transition:border-color .15s">
                    <div style="font-size:13px;font-weight:700;color:var(--text-1);text-align:center;
                      margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">${escHtml(cat.name)}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                      ${catItems.map(item => `
                        <div class="cat-bucket-item" data-id="${item.id}" data-ci="${ci}"
                          style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;
                            padding:6px;border-radius:var(--r-md);border:1px solid var(--border);background:var(--surface-2)">
                          <div style="width:100px;height:100px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center">
                            ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                              : `<span style="font-size:12px;text-align:center;padding:2px">${escHtml(item.label)}</span>`}
                          </div>
                        </div>`).join('')}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;

      await loadLazyImages(el);
      el.querySelector('#cat-close').addEventListener('click', () => player.close());

      // Тап на элемент в пуле — выбрать/снять
      el.querySelectorAll('.cat-pool-item').forEach(chip => {
        chip.addEventListener('click', () => {
          selected = selected === +chip.dataset.id ? null : +chip.dataset.id;
          render();
        });
        DnD.makeDraggable(chip, {
          data: { itemId: +chip.dataset.id, srcCi: null },
          onDragStart: () => { selected = null; },
        });
      });

      // Тап на корзину — положить выбранный
      el.querySelectorAll('.cat-bucket').forEach(bucket => {
        const ci = +bucket.dataset.ci;
        bucket.addEventListener('click', () => {
          if (selected !== null) {
            const item = allItems.find(it => it.id === selected);
            if (item && item.correctCat !== ci) wrongOnce.add(selected);
            placed[selected] = ci;
            selected = null;
            render();
          }
        });
        DnD.makeDropTarget(bucket, {
          onDrop: ({ itemId, srcCi }) => {
            const item = allItems.find(it => it.id === itemId);
            if (item && item.correctCat !== ci) wrongOnce.add(itemId);
            if (srcCi !== null && srcCi !== undefined) delete placed[itemId];
            placed[itemId] = ci;
            DnD.cleanup(el);
            render();
          },
        });
      });

      // Тап на размещённый — вернуть в пул
      el.querySelectorAll('.cat-bucket-item').forEach(chip => {
        chip.addEventListener('click', e => {
          e.stopPropagation();
          delete placed[+chip.dataset.id];
          render();
        });
        DnD.makeDraggable(chip, {
          data: { itemId: +chip.dataset.id, srcCi: +chip.dataset.ci },
          onDragStart: () => { selected = null; },
        });
      });

      el.querySelector('#cat-check')?.addEventListener('click', () => {
        const correctCount = allItems.filter(item => !wrongOnce.has(item.id) && placed[item.id] === item.correctCat).length;
        const duration = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correctCount, allItems.length, placed, duration);
        if (correctCount === allItems.length) Sound.win(); else Sound.next();
        PlayerTypes._showResult(el, player, correctCount, allItems.length, duration, null);
      });
    };
    await render();
  },

  // ── 10. Верно / Неверно ───────────────────────────────────────────────────
  async true_false(ex, content, studentId, player) {
    const statements = content.statements || [];
    if (!statements.length) { player.close(); toast('Нет утверждений', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const render = async () => {
      if (idx >= statements.length) {
        const duration = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, statements.length, {}, duration);
        PlayerTypes._showResult(el, player, correct, statements.length, duration, null);
        return;
      }
      const stmt = statements[idx];
      const pct  = Math.round(idx / statements.length * 100);

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="tf-close">Закрыть</button>
          <div class="player-progress-bar">
            <div class="player-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="player-counter">${idx+1} / ${statements.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:680px;text-align:center">
            ${stmt.img ? `<div style="margin-bottom:16px">
              <img src="" data-path="${escHtml(stmt.img)}" class="lazy-img"
                style="max-height:280px;max-width:100%;object-fit:contain;border-radius:var(--r-lg)"></div>` : ''}
            <div class="player-question" style="font-size:18px;margin-bottom:28px">${escHtml(stmt.text)}</div>
            <div style="display:flex;gap:16px;justify-content:center">
              <button class="tf-btn" data-ans="true"
                style="flex:1;max-width:260px;padding:24px;border-radius:var(--r-xl);
                  border:2px solid var(--green);background:var(--green-l);color:var(--green);
                  font-size:28px;font-weight:700;cursor:pointer;font-family:var(--font-ui);transition:all .15s">
                ✅ Верно
              </button>
              <button class="tf-btn" data-ans="false"
                style="flex:1;max-width:260px;padding:24px;border-radius:var(--r-xl);
                  border:2px solid var(--rose);background:var(--rose-l);color:var(--rose);
                  font-size:28px;font-weight:700;cursor:pointer;font-family:var(--font-ui);transition:all .15s">
                ❌ Неверно
              </button>
            </div>
          </div>
        </div>`;

      await loadLazyImages(el);
      el.querySelector('#tf-close').addEventListener('click', () => player.close());
      el.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const ans      = btn.dataset.ans === 'true';
          const isRight  = ans === stmt.correct;
          if (isRight) correct++;
          btn.style.transform = 'scale(1.05)';
          btn.textContent = isRight ? '✓ Правильно!' : '✗ Неверно';
          btn.style.background = isRight ? 'var(--green)' : 'var(--rose)';
          btn.style.color = '#fff';
          el.querySelectorAll('.tf-btn').forEach(b => b.style.pointerEvents = 'none');
          setTimeout(() => { idx++; render(); }, 800);
        });
      });
    };
    await render();
  },

  // ── 11. Составь слово ────────────────────────────────────────────────────
  async word_builder(ex, content, studentId, player) {
    const words = content.words || [];
    if (!words.length) { player.close(); toast('Нет слов', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let wordIdx = 0, correct = 0;

    const renderWord = async () => {
      if (wordIdx >= words.length) {
        const duration = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, words.length, {}, duration);
        PlayerTypes._showResult(el, player, correct, words.length, duration, null);
        return;
      }
      const word = words[wordIdx];
      const letters = word.text.toUpperCase().split('');
      const shuffled = [...letters];
      for (let i = shuffled.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // Pool: каждая буква с уникальным id
      const pool = shuffled.map((l, i) => ({ letter: l, id: i }));
      // Slots: массив длиной = слово, null = пусто, иначе {letter, id}
      let slots = Array(letters.length).fill(null);

      const renderInner = async () => {
        const allFilled = slots.every(s => s !== null);
        el.innerHTML = `
          <div class="player-topbar">
            <button class="btn btn-ghost btn-sm" id="wb-close">Закрыть</button>
            <div class="player-progress-bar">
              <div class="player-progress-fill" style="width:${wordIdx/words.length*100}%"></div>
            </div>
            <div class="player-counter">${wordIdx+1} / ${words.length}</div>
          </div>
          <div class="player-body">
            <div class="player-card" style="max-width:840px;text-align:center">
              ${word.img ? `<div style="margin-bottom:16px">
                <img src="" data-path="${escHtml(word.img)}" class="lazy-img"
                  style="max-height:240px;max-width:100%;object-fit:contain;border-radius:var(--r-lg)"></div>` : ''}

              <!-- Позиционные слоты ответа -->
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;
                min-height:76px;margin-bottom:24px;align-items:center">
                ${slots.map((s, pos) => s
                  ? `<div class="wb-slot wb-slot-filled" data-pos="${pos}"
                      style="width:68px;height:68px;border-radius:var(--r-lg);
                        background:var(--indigo);color:#fff;font-size:26px;font-weight:700;
                        display:flex;align-items:center;justify-content:center;
                        cursor:pointer;touch-action:none;user-select:none;
                        border:2px solid var(--indigo);transition:transform .1s">${s.letter}</div>`
                  : `<div class="wb-slot wb-slot-empty" data-pos="${pos}"
                      style="width:68px;height:68px;border-radius:var(--r-lg);
                        background:var(--surface-2);border:2px dashed var(--border-2);
                        display:flex;align-items:center;justify-content:center;
                        font-size:13px;font-weight:700;color:var(--text-3)">
                        ${pos+1}
                      </div>`
                ).join('')}
              </div>

              <!-- Пул букв -->
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px">
                ${pool.map(p => {
                  const isUsed = slots.some(s => s?.id === p.id);
                  return `<div class="wb-pool-letter ${isUsed ? '' : 'wb-pick'}" data-id="${p.id}"
                    style="width:68px;height:68px;border-radius:var(--r-lg);
                      background:${isUsed?'var(--surface-2)':'var(--surface)'};
                      color:${isUsed?'var(--text-3)':'var(--text-1)'};
                      border:2px solid ${isUsed?'var(--border)':'var(--border-2)'};
                      font-size:26px;font-weight:700;
                      display:flex;align-items:center;justify-content:center;
                      cursor:${isUsed?'default':'grab'};
                      opacity:${isUsed?.35:1};transition:all .15s;
                      touch-action:none;user-select:none">${p.letter}</div>`;
                }).join('')}
              </div>

              <div style="display:flex;gap:10px;justify-content:center">
                ${slots.some(s => s !== null) ? `<button class="btn btn-ghost" id="wb-clear">Очистить</button>` : ''}
                ${allFilled ? `<button class="btn btn-primary" id="wb-check">Проверить →</button>` : ''}
              </div>
            </div>
          </div>`;

        await loadLazyImages(el);
        el.querySelector('#wb-close').addEventListener('click', () => player.close());

        // ── Тап: пул → первый пустой слот ─────────────────────────────────
        el.querySelectorAll('.wb-pick').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = pool.find(p => p.id === +btn.dataset.id);
            if (!p || slots.some(s => s?.id === p.id)) return;
            const emptyPos = slots.findIndex(s => s === null);
            if (emptyPos !== -1) { slots[emptyPos] = { letter: p.letter, id: p.id }; renderInner(); }
          });
        });

        // ── Тап: заполненный слот → убрать букву обратно ──────────────────
        el.querySelectorAll('.wb-slot-filled').forEach(slot => {
          slot.addEventListener('click', () => {
            slots[+slot.dataset.pos] = null;
            renderInner();
          });
        });

        // ── DnD: буква из пула → конкретный слот ──────────────────────────
        el.querySelectorAll('.wb-pick').forEach(chip => {
          DnD.makeDraggable(chip, { data: { poolId: +chip.dataset.id } });
        });

        // ── DnD: заполненный слот → другой слот (swap/move) ───────────────
        el.querySelectorAll('.wb-slot-filled').forEach(slot => {
          DnD.makeDraggable(slot, { data: { fromPos: +slot.dataset.pos } });
        });

        // ── Drop targets: все слоты принимают буквы ────────────────────────
        el.querySelectorAll('.wb-slot').forEach(slot => {
          const toPos = +slot.dataset.pos;
          DnD.makeDropTarget(slot, {
            onDrop: (data) => {
              if (data.poolId !== undefined) {
                // Из пула
                const p = pool.find(p => p.id === data.poolId);
                if (!p || slots.some(s => s?.id === p.id)) return;
                if (slots[toPos] !== null) {
                  // Слот занят — буква уже на месте, просто не меняем
                  return;
                }
                slots[toPos] = { letter: p.letter, id: p.id };
              } else if (data.fromPos !== undefined) {
                // Из другого слота — swap
                const fromPos = data.fromPos;
                if (fromPos === toPos) return;
                [slots[fromPos], slots[toPos]] = [slots[toPos], slots[fromPos]];
              }
              DnD.cleanup(el);
              renderInner();
            },
          });
        });

        el.querySelector('#wb-clear')?.addEventListener('click', () => { slots = Array(letters.length).fill(null); renderInner(); });
        el.querySelector('#wb-check')?.addEventListener('click', () => {
          const assembled = slots.map(s => s?.letter || '').join('');
          const isRight   = assembled === word.text.toUpperCase();
          if (isRight) correct++;

          el.querySelectorAll('.wb-slot-filled').forEach(s => {
            s.style.background = isRight ? 'var(--green)' : 'var(--rose)';
            s.style.borderColor = isRight ? 'var(--green)' : 'var(--rose)';
          });

          if (!isRight) {
            setTimeout(() => {
              const correctDiv = document.createElement('div');
              correctDiv.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:10px';
              correctDiv.innerHTML = word.text.toUpperCase().split('').map(l =>
                `<div style="width:68px;height:68px;border-radius:var(--r-lg);background:var(--green);color:#fff;font-size:26px;font-weight:700;display:flex;align-items:center;justify-content:center">${l}</div>`
              ).join('');
              el.querySelector('.player-card')?.appendChild(correctDiv);
            }, 100);
          }

          setTimeout(() => { wordIdx++; renderWord(); }, isRight ? 600 : 1500);
        });
      };
      await renderInner();
    };
    await renderWord();
  },

  // ── 12. По размеру ───────────────────────────────────────────────────────
  async size_order(ex, content, studentId, player) {
    // Normalize: editor saves image/label, player uses img/label
    const items = (content.items || []).map(it => ({
      ...it,
      img:   it.img   || it.image || '',
      label: it.label || it.text  || '',
    }));
    if (items.length < 2) { player.close(); toast('Нужно минимум 2 элемента', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();

    const shuffled = [...items.map((item, i) => ({ ...item, correctIdx: i }))];
    for (let i = shuffled.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let order    = [...Array(shuffled.length).keys()];
    let selected = null; // тап-режим: выбранная позиция

    const render = async () => {
      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="so-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:840px">
            <div class="player-question" style="margin-bottom:20px">
              ${escHtml(content.instruction || 'Расставь от меньшего к большему')}
            </div>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px;align-items:flex-end">
              ${order.map((si, pos) => {
                const item  = shuffled[si];
                const isSel = selected === pos;
                return `<div class="so-item ${isSel?'selected':''}" data-pos="${pos}"
                  style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:grab;
                    padding:10px;border-radius:var(--r-xl);border:2px solid ${isSel?'var(--indigo)':'var(--border)'};
                    background:${isSel?'var(--indigo-l)':'var(--surface)'};transition:all .2s;min-width:80px;
                    user-select:none;touch-action:none">
                  <div style="font-size:12px;font-weight:700;color:${isSel?'var(--indigo)':'var(--text-3)'}">${pos+1}</div>
                  <div style="width:140px;height:180px;border-radius:var(--r-lg);overflow:hidden;
                    border:1px solid var(--border);display:flex;align-items:center;justify-content:center">
                    ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img" style="width:100%;height:100%;object-fit:cover">`
                      : `<span style="font-size:13px;font-weight:600;color:var(--text-2);text-align:center;padding:6px">${escHtml(item.label)}</span>`}
                  </div>
                  ${item.label ? `<div style="font-size:11px;color:var(--text-3);text-align:center;max-width:80px">${escHtml(item.label)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            <div style="text-align:center;font-size:12.5px;color:var(--text-3);margin-bottom:12px">
              Перетащи или нажми два элемента, чтобы поменять местами
            </div>
            <div style="text-align:center">
              <button class="btn btn-primary" id="so-check">Проверить →</button>
            </div>
          </div>
        </div>`;

      await loadLazyImages(el);
      el.querySelector('#so-close').addEventListener('click', () => player.close());

      // Тап: выбрать первый, потом второй → swap
      el.querySelectorAll('.so-item').forEach(card => {
        card.addEventListener('click', () => {
          const pos = +card.dataset.pos;
          if (selected === null) { selected = pos; render(); }
          else if (selected === pos) { selected = null; render(); }
          else {
            [order[selected], order[pos]] = [order[pos], order[selected]];
            selected = null; render();
          }
        });
      });

      // DnD: тащить одну карточку на другую → swap
      el.querySelectorAll('.so-item[data-pos]').forEach(card => {
        const fromPos = +card.dataset.pos;
        DnD.makeDraggable(card, {
          data: { fromPos },
          onDragStart: () => { selected = null; },
        });
        DnD.makeDropTarget(card, {
          onDrop: ({ fromPos: fp }) => {
            if (fp === undefined || fp === fromPos) return;
            [order[fp], order[fromPos]] = [order[fromPos], order[fp]];
            DnD.cleanup(el);
            render();
          },
        });
      });

      el.querySelector('#so-check').addEventListener('click', () => {
        const isCorrect = order.every((si, pos) => shuffled[si].correctIdx === pos);
        const duration  = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, isCorrect?1:0, 1, order, duration);
        if (isCorrect) Sound.win(); else Sound.error();
        PlayerTypes._showResult(el, player, isCorrect?1:0, 1, duration, async () => {
          for (let i = shuffled.length-1; i > 0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          order = [...Array(shuffled.length).keys()];
          render();
        });
      });
    };
    await render();
  },
});

// ── Подключаем к роутеру плеера ───────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
//  ПЛЕЕРЫ ДОПОЛНИТЕЛЬНЫХ ТИПОВ (pattern, story_order, word_to_pic,
//  fill_blank, first_sound, compare, emotion_match)
// ══════════════════════════════════════════════════════════════════════════════
Object.assign(PlayerTypes, {

  async pattern(ex, content, studentId, player) {
    const seqs = content.sequences || [];
    if (!seqs.length) { player.close(); toast('Нет рядов', 'error'); return; }

    const isImg     = content.mode === 'image';
    const el        = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const next = async () => {
      if (idx >= seqs.length) {
        const dur = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, seqs.length, [], dur);
        PlayerTypes._showResult(el, player, correct, seqs.length, dur, null);
        return;
      }
      const seq = seqs[idx];

      if (!isImg) {
        // ── Текстовый режим ───────────────────────────────────────────────────
        const shuffled = [...(seq.options||[]).map((v,i)=>({val:v,i}))].sort(()=>Math.random()-.5);

        el.innerHTML = `
          <div class="player-topbar">
            <button class="btn btn-ghost btn-sm" id="pat-close">Закрыть</button>
            <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
            <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${seqs.length}</div>
          </div>
          <div class="player-body">
            <div class="player-card" style="max-width:720px">
              <div class="player-question">Что идёт дальше?</div>
              <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin:20px 0 28px">
                ${(seq.items||[]).map(it => `
                  <div style="width:60px;height:60px;border-radius:var(--r-md);background:var(--surface);
                    border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:24px">
                    ${escHtml(String(it))}
                  </div>`).join('')}
              </div>
              <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center" id="pat-opts"></div>
            </div>
          </div>`;

        bindCloseBtn(el);
        const optsWrap = el.querySelector('#pat-opts');
        shuffled.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'player-opt';
          btn.style.cssText = 'width:72px;height:72px;font-size:26px;font-weight:800;padding:0;display:flex;align-items:center;justify-content:center';
          btn.textContent = String(opt.val);
          btn.addEventListener('click', () => {
            const ok = opt.i === seq.answer;
            if (ok) { Sound.success(); correct++; } else Sound.error();
            el.querySelectorAll('.player-opt').forEach(b => b.disabled = true);
            btn.style.background = ok ? 'var(--green-l)' : 'var(--rose-l)';
            btn.style.borderColor = ok ? 'var(--green)' : 'var(--rose)';
            if (!ok) {
              const correctBtn = [...el.querySelectorAll('.player-opt')].find((b,bi) => shuffled[bi]?.i === seq.answer);
              if (correctBtn) { correctBtn.style.background='var(--green-l)'; correctBtn.style.borderColor='var(--green)'; }
            }
            setTimeout(() => { idx++; next(); }, 1100);
          });
          optsWrap.appendChild(btn);
        });

      } else {
        // ── Режим картинок ────────────────────────────────────────────────────
        const items    = seq.items   || [];
        const gapIdx   = seq.gap_index ?? items.length - 1;
        const options  = seq.options  || [];
        const shuffled = [...options.map((op, i) => ({ op, i }))].sort(() => Math.random() - .5);

        // Сначала рендерим скелет — потом грузим картинки
        el.innerHTML = `
          <div class="player-topbar">
            <button class="btn btn-ghost btn-sm player-close-btn">Закрыть</button>
            <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
            <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${seqs.length}</div>
          </div>
          <div class="player-body">
            <div class="player-card" style="max-width:760px">
              <div class="player-question">Что стоит на месте знака вопроса?</div>

              <!-- Ряд с пропуском -->
              <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin:20px 0 28px" id="pat-row"></div>

              <!-- Варианты -->
              <div style="font-size:13px;color:var(--text-3);text-align:center;margin-bottom:12px">Выбери правильный вариант:</div>
              <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center" id="pat-opts-img"></div>
            </div>
          </div>`;

        bindCloseBtn(el);

        // Рендер ряда
        const rowWrap = el.querySelector('#pat-row');
        for (let ii = 0; ii < items.length; ii++) {
          const cell = document.createElement('div');
          cell.style.cssText = 'width:110px;height:110px;border-radius:var(--r-md);background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden;flex-shrink:0';
          if (ii === gapIdx) {
            cell.style.background = 'var(--surface-2)';
            cell.style.borderStyle = 'dashed';
            cell.innerHTML = '<span style="font-size:32px;color:var(--text-3)">?</span>';
          } else {
            const it = items[ii];
            if (it && it.img) {
              const d = await window.db.files.getImageData(it.img);
              if (d) cell.innerHTML = `<img src="${d}" style="width:100%;height:100%;object-fit:contain">`;
            }
            if (it && it.label) {
              const lbl = document.createElement('div');
              lbl.style.cssText = 'font-size:11px;color:var(--text-2);text-align:center;padding:2px 4px';
              lbl.textContent = it.label;
              cell.appendChild(lbl);
            }
          }
          rowWrap.appendChild(cell);
        }

        // Рендер вариантов
        const optsWrap = el.querySelector('#pat-opts-img');
        for (const { op, i } of shuffled) {
          const btn = document.createElement('button');
          btn.className = 'player-opt';
          btn.style.cssText = 'width:120px;height:120px;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;position:relative';
          if (op.img) {
            const d = await window.db.files.getImageData(op.img);
            if (d) {
              const img = document.createElement('img');
              img.src = d;
              img.style.cssText = 'width:100%;height:70px;object-fit:contain;border-radius:var(--r-sm)';
              btn.appendChild(img);
            }
          }
          if (op.label) {
            const lbl = document.createElement('div');
            lbl.style.cssText = 'font-size:11px;color:var(--text-2);text-align:center';
            lbl.textContent = op.label;
            btn.appendChild(lbl);
          }
          btn.addEventListener('click', () => {
            const ok = i === seq.answer;
            if (ok) { Sound.success(); correct++; } else Sound.error();
            el.querySelectorAll('#pat-opts-img .player-opt').forEach(b => b.disabled = true);
            btn.style.background    = ok ? 'var(--green-l)' : 'var(--rose-l)';
            btn.style.borderColor   = ok ? 'var(--green)'   : 'var(--rose)';
            if (!ok) {
              const correctBtn = [...el.querySelectorAll('#pat-opts-img .player-opt')]
                .find((b, bi) => shuffled[bi]?.i === seq.answer);
              if (correctBtn) { correctBtn.style.background = 'var(--green-l)'; correctBtn.style.borderColor = 'var(--green)'; }
            }
            setTimeout(() => { idx++; next(); }, 1100);
          });
          optsWrap.appendChild(btn);
        }
      }
    };
    await next();
  },

  // ── История по порядку (story_order) ─────────────────────────────────────
  async story_order(ex, content, studentId, player) {
    // Использует тот же контент что и sequencing (panels → items)
    const items = content.panels || content.items || [];
    await PlayerTypes.sequencing(
      ex,
      { ...content, items: items.map(p => ({ label: p.text || p.label || '', img: p.image || p.img || '' })) },
      studentId,
      player
    );
  },

  // ── Слово → картинка (word_to_pic) ───────────────────────────────────────
  async word_to_pic(ex, content, studentId, player) {
    const tasks = content.items || [];
    if (!tasks.length) { player.close(); toast('Нет заданий', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const next = async () => {
      if (idx >= tasks.length) {
        const dur = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, tasks.length, [], dur);
        PlayerTypes._showResult(el, player, correct, tasks.length, dur, null);
        return;
      }
      const task = tasks[idx];
      const pics = [...(task.pics||[]).map((p,i)=>({...p,origIdx:i}))].sort(()=>Math.random()-.5);

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="wtp-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${tasks.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:720px">
            <div style="font-size:44px;font-weight:800;letter-spacing:.08em;text-align:center;color:var(--text-1);
              margin-bottom:24px;font-family:var(--font-title)">${escHtml(task.word||'')}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px" id="wtp-grid"></div>
          </div>
        </div>`;
      bindCloseBtn(el);

      const grid = el.querySelector('#wtp-grid');
      for (const pic of pics) {
        const btn = document.createElement('button');
        btn.className = 'player-opt';
        btn.style.cssText = 'padding:12px;text-align:center;aspect-ratio:1;display:flex;align-items:center;justify-content:center';
        const imgPath = pic.image || pic.img || '';
        if (imgPath) {
          const d = await window.db.files.getImageData(imgPath);
          if (d) btn.innerHTML = `<img src="${d}" style="width:100%;height:100%;object-fit:contain;border-radius:var(--r-md)">`;
        }
        if (!btn.innerHTML && pic.text) btn.textContent = pic.text;
        btn.addEventListener('click', () => {
          const ok = pic.correct;
          if (ok) { Sound.success(); correct++; } else Sound.error();
          el.querySelectorAll('.player-opt').forEach(b => b.disabled = true);
          btn.style.background = ok ? 'var(--green-l)' : 'var(--rose-l)';
          btn.style.borderColor = ok ? 'var(--green)' : 'var(--rose)';
          setTimeout(() => { idx++; next(); }, 1000);
        });
        grid.appendChild(btn);
      }
    };
    next();
  },

  // ── Вставь слово (fill_blank) ─────────────────────────────────────────────
  async fill_blank(ex, content, studentId, player) {
    const sentences = content.sentences || [];
    if (!sentences.length) { player.close(); toast('Нет предложений', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const next = () => {
      if (idx >= sentences.length) {
        const dur = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, sentences.length, [], dur);
        PlayerTypes._showResult(el, player, correct, sentences.length, dur, null);
        return;
      }
      const s = sentences[idx];
      const opts = [...[s.correct, ...(s.options||[]).filter(Boolean)]].filter(Boolean).sort(()=>Math.random()-.5);
      const parts = (s.text||'').split('___');

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="fb-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${sentences.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:680px">
            <div style="font-size:22px;font-weight:500;text-align:center;line-height:1.8;margin-bottom:28px;color:var(--text-1)">
              ${escHtml(parts[0])}<span style="display:inline-block;min-width:80px;border-bottom:3px solid var(--indigo);
              margin:0 6px;text-align:center;font-weight:700;color:var(--indigo)" id="fb-blank"> ? </span>${escHtml(parts[1]||'')}
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center" id="fb-opts"></div>
          </div>
        </div>`;
      bindCloseBtn(el);

      const optsWrap = el.querySelector('#fb-opts');
      opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'player-opt';
        btn.style.cssText = 'font-size:19px;padding:14px 28px;font-weight:600';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          const ok = opt === s.correct;
          if (ok) { Sound.success(); correct++; } else Sound.error();
          el.querySelector('#fb-blank').textContent = opt;
          el.querySelector('#fb-blank').style.color = ok ? 'var(--green)' : 'var(--rose)';
          el.querySelectorAll('.player-opt').forEach(b => b.disabled = true);
          btn.style.background = ok ? 'var(--green-l)' : 'var(--rose-l)';
          btn.style.borderColor = ok ? 'var(--green)' : 'var(--rose)';
          setTimeout(() => { idx++; next(); }, 1000);
        });
        optsWrap.appendChild(btn);
      });
    };
    next();
  },

  // ── Первый звук (first_sound) ─────────────────────────────────────────────
  async first_sound(ex, content, studentId, player) {
    const items = content.items || [];
    if (!items.length) { player.close(); toast('Нет заданий', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const next = async () => {
      if (idx >= items.length) {
        const dur = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, items.length, [], dur);
        PlayerTypes._showResult(el, player, correct, items.length, dur, null);
        return;
      }
      const item = items[idx];
      const letters = [...(item.letters||[])].sort(()=>Math.random()-.5);

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="fs-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${items.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:660px">
            <div style="text-align:center;margin-bottom:24px">
              <div id="fs-img" style="margin-bottom:12px"></div>
              <div style="font-size:26px;font-weight:700;color:var(--text-1);margin-bottom:6px">${escHtml(item.word||'')}</div>
              <div style="font-size:14px;color:var(--text-3)">Выбери первый звук</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center" id="fs-opts"></div>
          </div>
        </div>`;
      bindCloseBtn(el);

      const imgPath = item.image || item.img || '';
      if (imgPath) {
        const d = await window.db.files.getImageData(imgPath);
        if (d) el.querySelector('#fs-img').innerHTML = `<img src="${d}" style="height:240px;object-fit:contain;border-radius:var(--r-md)">`;
      }

      const optsWrap = el.querySelector('#fs-opts');
      letters.forEach(lt => {
        const btn = document.createElement('button');
        btn.className = 'player-opt';
        btn.style.cssText = 'width:72px;height:72px;font-size:34px;font-weight:800;text-transform:uppercase;padding:0;display:flex;align-items:center;justify-content:center';
        btn.textContent = lt.letter;
        btn.addEventListener('click', () => {
          const ok = lt.correct;
          if (ok) { Sound.success(); correct++; } else Sound.error();
          el.querySelectorAll('.player-opt').forEach(b => b.disabled = true);
          btn.style.background = ok ? 'var(--green-l)' : 'var(--rose-l)';
          btn.style.borderColor = ok ? 'var(--green)' : 'var(--rose)';
          const correctBtn = [...el.querySelectorAll('.player-opt')].find(b => letters.find(l=>l.letter===b.textContent&&l.correct));
          if (!ok && correctBtn) { correctBtn.style.background='var(--green-l)'; correctBtn.style.borderColor='var(--green)'; }
          setTimeout(() => { idx++; next(); }, 1000);
        });
        optsWrap.appendChild(btn);
      });
    };
    next();
  },

  // ── Сравни (compare) ──────────────────────────────────────────────────────
  async compare(ex, content, studentId, player) {
    const tasks = content.tasks || [];
    if (!tasks.length) { player.close(); toast('Нет заданий', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const next = () => {
      if (idx >= tasks.length) {
        const dur = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, tasks.length, [], dur);
        PlayerTypes._showResult(el, player, correct, tasks.length, dur, null);
        return;
      }
      const task = tasks[idx];
      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="cmp-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${tasks.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:680px">
            ${task.question ? `<div class="player-question">${escHtml(task.question)}</div>` : ''}
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin:20px 0 28px">
              <div style="text-align:center;background:var(--surface);border:2px solid var(--border);border-radius:var(--r-xl);padding:20px">
                <div style="font-size:44px;font-weight:800">${escHtml(task.left||'?')}</div>
              </div>
              <div style="font-size:32px;color:var(--text-3)" id="cmp-sign">?</div>
              <div style="text-align:center;background:var(--surface);border:2px solid var(--border);border-radius:var(--r-xl);padding:20px">
                <div style="font-size:44px;font-weight:800">${escHtml(task.right||'?')}</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:center">
              ${[{v:'>',l:'>'},{v:'<',l:'<'},{v:'=',l:'='}].map(opt =>
                `<button class="player-opt cmp-btn" data-v="${opt.v}"
                  style="width:72px;height:72px;font-size:32px;font-weight:800;padding:0">${opt.l}</button>`
              ).join('')}
            </div>
          </div>
        </div>`;
      bindCloseBtn(el);

      el.querySelectorAll('.cmp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const ok = btn.dataset.v === task.answer;
          if (ok) { Sound.success(); correct++; } else Sound.error();
          el.querySelector('#cmp-sign').textContent = btn.dataset.v;
          el.querySelector('#cmp-sign').style.color = ok ? 'var(--green)' : 'var(--rose)';
          el.querySelectorAll('.player-opt').forEach(b => b.disabled = true);
          btn.style.background = ok ? 'var(--green-l)' : 'var(--rose-l)';
          btn.style.borderColor = ok ? 'var(--green)' : 'var(--rose)';
          setTimeout(() => { idx++; next(); }, 1000);
        });
      });
    };
    next();
  },

  // ── Назови эмоцию (emotion_match) ────────────────────────────────────────
  async emotion_match(ex, content, studentId, player) {
    const tasks = content.tasks || [];
    if (!tasks.length) { player.close(); toast('Нет заданий', 'error'); return; }

    const el = player._el;
    const startTime = Date.now();
    let idx = 0, correct = 0;

    const next = async () => {
      if (idx >= tasks.length) {
        const dur = Math.round((Date.now()-startTime)/1000);
        player._saveResult(studentId, ex.id, correct, tasks.length, [], dur);
        PlayerTypes._showResult(el, player, correct, tasks.length, dur, null);
        return;
      }
      const task = tasks[idx];
      const emotions = [...(task.emotions||[])].sort(()=>Math.random()-.5);

      el.innerHTML = `
        <div class="player-topbar">
          <button class="btn btn-ghost btn-sm" id="em-close">Закрыть</button>
          <div style="font-size:14px;font-weight:600">${escHtml(ex.name)}</div>
          <div style="margin-left:auto;font-size:13px;color:var(--text-3)">${idx+1}/${tasks.length}</div>
        </div>
        <div class="player-body">
          <div class="player-card" style="max-width:680px">
            <div style="text-align:center;margin-bottom:20px">
              <div id="em-img" style="margin-bottom:12px"></div>
              ${task.situation ? `<div style="font-size:15px;line-height:1.6;color:var(--text-1);max-width:440px;margin:0 auto">${escHtml(task.situation)}</div>` : ''}
            </div>
            <div style="font-size:12.5px;font-weight:700;color:var(--text-3);text-align:center;margin-bottom:16px">Что чувствует?</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center" id="em-opts"></div>
          </div>
        </div>`;
      bindCloseBtn(el);

      const imgPath = task.image || task.img || '';
      if (imgPath) {
        const d = await window.db.files.getImageData(imgPath);
        if (d) el.querySelector('#em-img').innerHTML = `<img src="${d}" style="height:240px;object-fit:contain;border-radius:var(--r-lg)">`;
      }

      const optsWrap = el.querySelector('#em-opts');
      emotions.forEach(emo => {
        const btn = document.createElement('button');
        btn.className = 'player-opt';
        btn.style.cssText = 'padding:12px 20px;font-size:15px;min-width:120px';
        btn.textContent = emo.label;
        btn.addEventListener('click', () => {
          const ok = emo.correct;
          if (ok) { Sound.success(); correct++; } else Sound.error();
          el.querySelectorAll('.player-opt').forEach(b => {
            b.disabled = true;
            if (emotions.find(e => e.label === b.textContent && e.correct)) {
              b.style.background = 'var(--green-l)';
              b.style.borderColor = 'var(--green)';
            }
          });
          if (!ok) { btn.style.background = 'var(--rose-l)'; btn.style.borderColor = 'var(--rose)'; }
          setTimeout(() => { idx++; next(); }, 1100);
        });
        optsWrap.appendChild(btn);
      });
    };
    next();
  },
});

