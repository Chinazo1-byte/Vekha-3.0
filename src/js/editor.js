// ══════════════════════════════════════════════════════════════════════════════
//  РЕДАКТОР УПРАЖНЕНИЙ
//  Открывается поверх основного интерфейса для наполнения упражнения контентом
// ══════════════════════════════════════════════════════════════════════════════

const Editor = {
  _el: null,
  _exercise: null,
  _content: {},
  _onSave: null,

  async open(exerciseId, onSave) {
    const ex = await window.db.exercises.get(exerciseId);
    if (!ex) return;

    this._exercise = ex;
    this._onSave   = onSave;

    try {
      this._content = JSON.parse(ex.content || '{}');
    } catch(e) { this._content = {}; }

    this._render();
  },

  close() {
    this._el?.remove();
    this._el = null;
  },

  _render() {
    this._el?.remove();
    const el = document.createElement('div');
    el.className = 'editor-overlay';
    el.id = 'editor-overlay';

    const ex   = this._exercise;
    const meta = exerciseTypeMeta(ex.type);

    el.innerHTML = `
      <div class="editor-topbar">
        <button class="btn btn-ghost btn-sm" id="editor-close">${Icons.back} Назад</button>
        <div class="editor-title">${escHtml(ex.name)}</div>
        <span class="editor-type-badge" style="background:${meta.colorL};color:${meta.color}">${meta.label}</span>
        <div style="margin-left:auto;display:flex;gap:10px">
          <button class="btn btn-success" id="editor-save">Сохранить</button>
        </div>
      </div>
      <div class="editor-body">
        <div class="editor-main" id="editor-main"></div>
        <div class="editor-sidebar" id="editor-sidebar"></div>
      </div>
    `;

    document.body.appendChild(el);
    this._el = el;

    el.querySelector('#editor-close').onclick = () => this.close();
    el.querySelector('#editor-save').onclick  = () => this._save();

    this._renderByType();
  },

  _renderByType() {
    const type = this._exercise.type;
    const fns  = {
      visual_match: () => EditorTypes.visualMatch(this),
      find_pairs:   () => EditorTypes.findPairs(this),
      memory_game:  () => EditorTypes.memory_game(this),
      odd_one_out:  () => EditorTypes.oddOneOut(this),
      sorting:      () => EditorTypes.sorting(this),
    };
    const fn = fns[type];
    if (fn) fn();
    else {
      document.getElementById('editor-main').innerHTML = `
        <div class="empty-state">
          <div class="empty-title">Редактор для типа «${escHtml(exerciseTypeMeta(type).label)}» в разработке</div>
        </div>`;
    }
  },

  get _bodyEl() {
    return document.getElementById('editor-main');
  },

  async _save() {
    await window.db.exercises.update({
      ...this._exercise,
      content: this._content,
    });
    toast('Сохранено', 'success');
    this._onSave?.();
    this.close();
  },
};

// ── Общий хелпер: выбор изображения ──────────────────────────────────────────
async function pickImage(onPicked) {
  const path = await window.db.files.pickImage();
  if (!path) return;
  const dataUrl = await window.db.files.getImageData(path);
  onPicked(path, dataUrl);
}

function imgOrText(src, text, size = 80) {
  if (src) return `<img src="" data-path="${escHtml(src)}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:8px" class="lazy-img">`;
  return `<span>${escHtml(text)}</span>`;
}

// Ленивая загрузка изображений через IPC
async function loadLazyImages(container) {
  const imgs = (container || document).querySelectorAll('img.lazy-img');
  for (const img of imgs) {
    const p = img.dataset.path;
    if (p && !img.src.startsWith('data:')) {
      const d = await window.db.files.getImageData(p);
      if (d) img.src = d;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  ТИПЫ РЕДАКТОРОВ
// ══════════════════════════════════════════════════════════════════════════════
const EditorTypes = {

  // ── Visual Match: сопоставление — левый объект ↔ правый объект ─────────────
  // Схема: { items: [{question, question_img, answer, answer_img}] }
  // Поля question/answer сохранены для обратной совместимости.
  visualMatch(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="max-width:700px">
          <div style="font-size:22px;font-weight:700;color:var(--text-1);margin-bottom:6px">Сопоставление</div>
          <div style="color:var(--text-3);font-size:13.5px;margin-bottom:24px">
            Ученик видит два столбца и соединяет каждый объект слева с его парой справа.
          </div>

          <!-- Список пар -->
          <div id="vm-items" style="margin-bottom:20px"></div>

          <!-- Форма добавления пары -->
          <div class="add-item-row" style="flex-direction:column;gap:14px">
            <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em">
              Добавить пару
            </div>
            <div style="display:grid;grid-template-columns:1fr 28px 1fr;gap:10px;align-items:start">

              <!-- Левый объект -->
              <div style="display:flex;flex-direction:column;gap:8px">
                <div style="font-size:11.5px;font-weight:700;color:var(--indigo)">ОБЪЕКТ (левый столбец)</div>
                <input class="input-field" id="vm-q-text" placeholder="Текст (необязательно)">
                <div id="vm-q-img-preview" style="min-height:0"></div>
                <button class="btn btn-ghost btn-sm" id="vm-q-img-btn">🖼 Картинка</button>
              </div>

              <!-- Стрелка -->
              <div style="display:flex;align-items:center;justify-content:center;padding-top:28px;
                font-size:20px;color:var(--text-3)">↔</div>

              <!-- Правый объект -->
              <div style="display:flex;flex-direction:column;gap:8px">
                <div style="font-size:11.5px;font-weight:700;color:var(--green)">ПАРА (правый столбец)</div>
                <input class="input-field" id="vm-a-text" placeholder="Текст (необязательно)">
                <div id="vm-a-img-preview" style="min-height:0"></div>
                <button class="btn btn-ghost btn-sm" id="vm-a-img-btn">🖼 Картинка</button>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end">
              <button class="btn btn-primary" id="vm-add-btn">+ Добавить пару</button>
            </div>
          </div>
        </div>`;

      let newQImg = '', newAImg = '';

      document.getElementById('vm-q-img-btn').onclick = () => pickImage((path, data) => {
        newQImg = path;
        document.getElementById('vm-q-img-preview').innerHTML =
          `<img src="${data}" style="max-height:100px;border-radius:8px;margin-top:2px;display:block">`;
      });

      document.getElementById('vm-a-img-btn').onclick = () => pickImage((path, data) => {
        newAImg = path;
        document.getElementById('vm-a-img-preview').innerHTML =
          `<img src="${data}" style="max-height:100px;border-radius:8px;margin-top:2px;display:block">`;
      });

      document.getElementById('vm-add-btn').onclick = () => {
        const qText = document.getElementById('vm-q-text').value.trim();
        const aText = document.getElementById('vm-a-text').value.trim();
        if (!qText && !newQImg) { toast('Добавьте текст или картинку для левого объекта', 'error'); return; }
        if (!aText && !newAImg) { toast('Добавьте текст или картинку для пары', 'error'); return; }

        c.items.push({
          question: qText, question_img: newQImg,
          answer:   aText, answer_img:   newAImg,
        });
        newQImg = ''; newAImg = '';
        render();
      };

      renderItems();
    }

    async function renderItems() {
      const container = document.getElementById('vm-items');
      if (!container) return;
      if (!c.items.length) {
        container.innerHTML = `<div style="color:var(--text-3);font-size:13px;text-align:center;padding:16px 0">
          Пар пока нет — добавьте первую пару ниже.</div>`;
        return;
      }

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 28px 1fr;gap:0 10px;align-items:stretch">
          <div style="font-size:11px;font-weight:700;color:var(--indigo);text-transform:uppercase;
            letter-spacing:.05em;padding:0 0 8px 4px">Объект</div>
          <div></div>
          <div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;
            letter-spacing:.05em;padding:0 0 8px 4px">Пара</div>
          ${c.items.map((item, i) => `
            <div class="item-card" style="margin-bottom:8px;position:relative">
              ${item.question_img
                ? `<img data-path="${escHtml(item.question_img)}" class="lazy-img"
                    style="width:100%;max-height:110px;object-fit:contain;border-radius:8px;margin-bottom:6px">`
                : ''}
              <div style="font-size:14px;font-weight:500;color:var(--text-1)">
                ${escHtml(item.question) || '<span style="color:var(--text-3)">—</span>'}
              </div>
              <button class="item-delete" data-i="${i}" style="position:absolute;top:8px;right:8px">
                ${Icons.trash}
              </button>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;font-size:18px;
              color:var(--text-3);margin-bottom:8px">↔</div>
            <div class="item-card" style="margin-bottom:8px">
              ${item.answer_img
                ? `<img data-path="${escHtml(item.answer_img)}" class="lazy-img"
                    style="width:100%;max-height:110px;object-fit:contain;border-radius:8px;margin-bottom:6px">`
                : ''}
              <div style="font-size:14px;font-weight:500;color:var(--green)">
                ${escHtml(item.answer) || '—'}
              </div>
            </div>
          `).join('')}
        </div>`;

      container.querySelectorAll('.item-delete').forEach(btn => {
        btn.onclick = () => { c.items.splice(+btn.dataset.i, 1); render(); };
      });

      await loadLazyImages(container);

      // Обновить счётчик в сайдбаре
      const cnt = document.getElementById('vm-count');
      if (cnt) cnt.textContent = c.items.length;
    }

    render();

    document.getElementById('editor-sidebar').innerHTML = `
      <div class="editor-section-title">Как работает</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.7">
        Ученик видит два столбца: слева объекты, справа их пары — перемешанные.<br><br>
        Нажимает на объект слева → нажимает его пару справа → линия соединяет их.<br><br>
        Правильное соединение остаётся, неправильное стряхивает обе карточки.
      </div>
      <div class="divider"></div>
      <div class="editor-section-title">Пар: <span id="vm-count">${c.items.length}</span></div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.5;margin-top:4px">
        Рекомендуется 3–7 пар. При большом количестве упражнение становится сложным.
      </div>`;
  },

  // ── Мемо: открытые карточки, ищем совпадения ────────────────────────────────
  memory_game(editor) {
    const c = editor._content;
    if (!c.pairs) c.pairs = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="max-width:640px">
          <div style="font-size:22px;font-weight:700;color:var(--text-1);margin-bottom:6px">Мемо</div>
          <div style="color:var(--text-3);font-size:13.5px;margin-bottom:28px">Карточки перемешиваются. Ученик открывает по две и ищет совпадающие пары.</div>

          <div id="fp-items" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"></div>

          <div class="add-item-row">
            <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px">КАРТОЧКА А</div>
                <input class="input-field" id="fp-a-text" placeholder="Текст или слово">
                <div id="fp-a-img-p" style="margin-top:6px"></div>
                <button class="btn btn-ghost btn-sm" id="fp-a-img-btn" style="margin-top:6px">+ Картинка</button>
              </div>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px">КАРТОЧКА Б</div>
                <input class="input-field" id="fp-b-text" placeholder="Пара к А">
                <div id="fp-b-img-p" style="margin-top:6px"></div>
                <button class="btn btn-ghost btn-sm" id="fp-b-img-btn" style="margin-top:6px">+ Картинка</button>
              </div>
            </div>
            <button class="btn btn-primary" id="fp-add-btn" style="align-self:flex-end">Добавить пару</button>
          </div>
        </div>`;

      let imgA = '', imgB = '';
      document.getElementById('fp-a-img-btn').onclick = () => pickImage((p, d) => {
        imgA = p;
        document.getElementById('fp-a-img-p').innerHTML = `<img src="${d}" style="max-height:70px;border-radius:6px">`;
      });
      document.getElementById('fp-b-img-btn').onclick = () => pickImage((p, d) => {
        imgB = p;
        document.getElementById('fp-b-img-p').innerHTML = `<img src="${d}" style="max-height:70px;border-radius:6px">`;
      });

      document.getElementById('fp-add-btn').onclick = () => {
        const a = document.getElementById('fp-a-text').value.trim();
        const b = document.getElementById('fp-b-text').value.trim();
        if (!a && !imgA) { toast('Введите карточку А', 'error'); return; }
        if (!b && !imgB) { toast('Введите карточку Б', 'error'); return; }
        c.pairs.push({ a_text: a, a_img: imgA, b_text: b, b_img: imgB });
        imgA = ''; imgB = '';
        render();
      };

      renderItems();
    }

    async function renderItems() {
      const container = document.getElementById('fp-items');
      if (!container) return;
      container.innerHTML = c.pairs.map((pair, i) => `
        <div class="item-card" style="display:flex;align-items:center;gap:10px">
          <button class="item-delete" data-i="${i}">${Icons.trash}</button>
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <div style="text-align:center;flex:1">
              ${pair.a_img ? `<img data-path="${escHtml(pair.a_img)}" class="lazy-img" style="max-height:60px;border-radius:6px">` : ''}
              <div style="font-size:13.5px;font-weight:600">${escHtml(pair.a_text)||'—'}</div>
            </div>
            <div style="color:var(--text-3)">↔</div>
            <div style="text-align:center;flex:1">
              ${pair.b_img ? `<img data-path="${escHtml(pair.b_img)}" class="lazy-img" style="max-height:60px;border-radius:6px">` : ''}
              <div style="font-size:13.5px;font-weight:600">${escHtml(pair.b_text)||'—'}</div>
            </div>
          </div>
        </div>`).join('');
      container.querySelectorAll('.item-delete').forEach(btn => {
        btn.onclick = () => { c.pairs.splice(+btn.dataset.i, 1); render(); };
      });
      await loadLazyImages(container);
    }

    render();

    document.getElementById('editor-sidebar').innerHTML = `
      <div class="editor-section-title">Подсказка</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.6">
        Все карточки перемешиваются и кладутся «рубашкой» вниз. Ученик открывает по две — если совпали, остаются открытыми.
      </div>
      <div class="divider"></div>
      <div class="editor-section-title">Пар: ${c.pairs.length}</div>`;
  },

  // ── Найди пару (find_pairs) ──────────────────────────────────────────────────
  findPairs(editor) {
    const c = editor._content;
    if (!c.pairs) c.pairs = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="max-width:700px">
          <div style="font-size:22px;font-weight:700;color:var(--text-1);margin-bottom:6px">Найди пару</div>
          <div style="color:var(--text-3);font-size:13.5px;margin-bottom:24px">
            Ученик видит два столбца объектов и соединяет каждый из левого столбца с его парой из правого.
          </div>

          <div id="fpv2-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px"></div>

          <details style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden">
            <summary style="padding:12px 16px;cursor:pointer;font-weight:600;font-size:13.5px;
                            background:var(--surface);color:var(--text-1);list-style:none;user-select:none">
              + Добавить пару
            </summary>
            <div style="padding:16px;background:var(--bg);border-top:1px solid var(--border)">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:14px">
                <div>
                  <div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:8px;letter-spacing:.04em">ОБЪЕКТ А</div>
                  <input class="input-field" id="fpv2-a-text" placeholder="Текст (необязательно)" style="margin-bottom:8px">
                  <div id="fpv2-a-img-p"></div>
                  <button class="btn btn-ghost btn-sm" id="fpv2-a-img-btn" style="margin-top:6px">+ Картинка</button>
                </div>
                <div>
                  <div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:8px;letter-spacing:.04em">ОБЪЕКТ Б (пара)</div>
                  <input class="input-field" id="fpv2-b-text" placeholder="Текст (необязательно)" style="margin-bottom:8px">
                  <div id="fpv2-b-img-p"></div>
                  <button class="btn btn-ghost btn-sm" id="fpv2-b-img-btn" style="margin-top:6px">+ Картинка</button>
                </div>
              </div>
              <button class="btn btn-primary" id="fpv2-add-btn">Добавить</button>
            </div>
          </details>
        </div>`;

      let imgA = '', imgB = '';

      document.getElementById('fpv2-a-img-btn').onclick = () => pickImage((p, d) => {
        imgA = p;
        document.getElementById('fpv2-a-img-p').innerHTML =
          `<img src="${d}" style="max-height:70px;border-radius:6px;display:block">`;
      });
      document.getElementById('fpv2-b-img-btn').onclick = () => pickImage((p, d) => {
        imgB = p;
        document.getElementById('fpv2-b-img-p').innerHTML =
          `<img src="${d}" style="max-height:70px;border-radius:6px;display:block">`;
      });

      document.getElementById('fpv2-add-btn').onclick = () => {
        const a = document.getElementById('fpv2-a-text').value.trim();
        const b = document.getElementById('fpv2-b-text').value.trim();
        if (!a && !imgA) { toast('Укажите объект А', 'error'); return; }
        if (!b && !imgB) { toast('Укажите объект Б', 'error'); return; }
        c.pairs.push({ a_text: a, a_img: imgA, b_text: b, b_img: imgB });
        imgA = ''; imgB = '';
        render();
      };

      renderItems();
    }

    async function renderItems() {
      const container = document.getElementById('fpv2-list');
      if (!container) return;
      container.innerHTML = c.pairs.length === 0
        ? `<div style="color:var(--text-3);font-size:13px;padding:8px 0">Пар пока нет</div>`
        : c.pairs.map((pair, i) => `
          <div class="item-card" style="display:grid;grid-template-columns:auto 1fr 28px 1fr auto;align-items:center;gap:10px;padding:10px 14px">
            <div style="font-size:12px;font-weight:700;color:var(--text-3);min-width:18px">${i + 1}</div>
            <div style="display:flex;align-items:center;gap:8px">
              ${pair.a_img ? `<img data-path="${escHtml(pair.a_img)}" class="lazy-img" style="max-height:52px;border-radius:6px">` : ''}
              <div style="font-size:13.5px;font-weight:600">${escHtml(pair.a_text) || '<span style="color:var(--text-3)">—</span>'}</div>
            </div>
            <div style="color:var(--text-3);text-align:center">↔</div>
            <div style="display:flex;align-items:center;gap:8px">
              ${pair.b_img ? `<img data-path="${escHtml(pair.b_img)}" class="lazy-img" style="max-height:52px;border-radius:6px">` : ''}
              <div style="font-size:13.5px;font-weight:600">${escHtml(pair.b_text) || '<span style="color:var(--text-3)">—</span>'}</div>
            </div>
            <button class="item-delete" data-i="${i}">${Icons.trash}</button>
          </div>`).join('');

      container.querySelectorAll('.item-delete').forEach(btn => {
        btn.onclick = () => { c.pairs.splice(+btn.dataset.i, 1); render(); };
      });
      await loadLazyImages(container);
    }

    render();

    document.getElementById('editor-sidebar').innerHTML = `
      <div class="editor-section-title">Подсказка</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.6">
        Правый столбец перемешивается. Ученик нажимает объект из левого столбца, затем его пару из правого — они соединяются линией.
      </div>
      <div class="divider"></div>
      <div class="editor-section-title">Пар: ${c.pairs.length}</div>`;
  },

  // ── Odd One Out: 4 слова, одно лишнее ─────────────────────────────────────
  oddOneOut(editor) {
    const c = editor._content;
    if (!c.tasks) c.tasks = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="max-width:640px">
          <div style="font-size:22px;font-weight:700;color:var(--text-1);margin-bottom:6px">Лишний предмет</div>
          <div style="color:var(--text-3);font-size:13.5px;margin-bottom:28px">Ученик видит 4 элемента и выбирает тот, который не подходит к остальным.</div>

          <div id="oo-items" style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px"></div>

          <div class="add-item-row" style="flex-direction:column;gap:12px">
            <div style="font-size:12.5px;font-weight:600;color:var(--text-2)">ДОБАВИТЬ ЗАДАНИЕ</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="oo-inputs">
              ${[0,1,2,3].map(i => `
                <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:12px;background:var(--surface)">
                  <div style="font-size:11px;font-weight:700;color:${i===0?'var(--rose)':'var(--text-3)'};margin-bottom:8px">
                    ${i===0 ? 'ЛИШНИЙ' : `ЭЛЕМЕНТ ${i+1}`}
                  </div>
                  <input class="input-field" id="oo-t${i}" placeholder="Текст">
                  <div id="oo-img-p${i}" style="margin-top:6px"></div>
                  <button class="btn btn-ghost btn-sm" data-idx="${i}" style="margin-top:6px" id="oo-img-btn${i}">+ Картинка</button>
                </div>`).join('')}
            </div>
            <button class="btn btn-primary" id="oo-add-btn">Добавить задание</button>
          </div>
        </div>`;

      const imgs = ['', '', '', ''];
      [0,1,2,3].forEach(i => {
        document.getElementById(`oo-img-btn${i}`).onclick = () => pickImage((p, d) => {
          imgs[i] = p;
          document.getElementById(`oo-img-p${i}`).innerHTML = `<img src="${d}" style="max-height:60px;border-radius:6px">`;
        });
      });

      document.getElementById('oo-add-btn').onclick = () => {
        const texts = [0,1,2,3].map(i => document.getElementById(`oo-t${i}`).value.trim());
        if (!texts[0] && !imgs[0]) { toast('Укажите лишний элемент', 'error'); return; }
        const items = texts.map((t, i) => ({ text: t, img: imgs[i] }));
        c.tasks.push({ items, odd_index: 0 });
        render();
      };

      renderItems();
    }

    async function renderItems() {
      const container = document.getElementById('oo-items');
      if (!container) return;
      container.innerHTML = c.tasks.map((task, i) => `
        <div class="item-card">
          <button class="item-delete" data-i="${i}">${Icons.trash}</button>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            ${task.items.map((it, j) => `
              <div style="text-align:center;padding:8px 12px;border-radius:var(--r-md);background:${j===0?'var(--rose-l)':'var(--surface-2)'};border:1px solid ${j===0?'#FECACA':'var(--border)'}">
                ${it.img ? `<img data-path="${escHtml(it.img)}" class="lazy-img" style="width:48px;height:48px;object-fit:cover;border-radius:6px;display:block">` : ''}
                <div style="font-size:12.5px;font-weight:600;color:${j===0?'var(--rose)':'var(--text-1)'}">${escHtml(it.text)||'—'}</div>
                ${j===0?'<div style="font-size:10px;color:var(--rose);margin-top:2px">лишний</div>':''}
              </div>`).join('')}
          </div>
        </div>`).join('');
      container.querySelectorAll('.item-delete').forEach(btn => {
        btn.onclick = () => { c.tasks.splice(+btn.dataset.i, 1); render(); };
      });
      await loadLazyImages(container);
    }

    render();

    document.getElementById('editor-sidebar').innerHTML = `
      <div class="editor-section-title">Подсказка</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.6">
        Первый элемент в каждом задании — <b style="color:var(--rose)">лишний</b>. Остальные три — подходящие между собой.
      </div>
      <div class="divider"></div>
      <div class="editor-section-title">Заданий: ${c.tasks.length}</div>`;
  },

  // ── Sorting: распределить по категориям ────────────────────────────────────
  sorting(editor) {
    const c = editor._content;
    if (!c.categories) c.categories = [];
    if (!c.items) c.items = [];

    // Миграция: если категории — массив строк (старый формат), переводим в объекты
    c.categories = c.categories.map(cat =>
      typeof cat === 'string' ? { name: cat, img: '' } : cat
    );

    // Имя категории (строка) — для совместимости с items.category
    function catName(cat) { return typeof cat === 'string' ? cat : cat.name; }

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="max-width:700px">
          <div style="font-size:22px;font-weight:700;color:var(--text-1);margin-bottom:6px">Сортировка</div>
          <div style="color:var(--text-3);font-size:13.5px;margin-bottom:24px">
            Ученик перетаскивает элементы в правильные корзины.
          </div>

          <!-- Категории -->
          <div class="editor-section-title">Корзины (категории)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:14px" id="sort-cats-grid">
            ${c.categories.map((cat, i) => `
              <div class="item-card" style="padding:12px;position:relative">
                <button class="item-delete sort-del-cat" data-i="${i}">${Icons.trash}</button>
                <div style="display:flex;flex-direction:column;gap:8px;align-items:center">
                  <!-- Картинка категории -->
                  <div id="sort-cat-img-wrap-${i}" style="width:80px;height:80px;border-radius:var(--r-md);
                    overflow:hidden;border:2px dashed var(--border);display:flex;align-items:center;
                    justify-content:center;cursor:pointer;flex-shrink:0;background:var(--surface-2)"
                    data-cat-img-btn="${i}">
                    ${cat.img
                      ? `<img data-path="${escHtml(cat.img)}" class="lazy-img"
                          style="width:100%;height:100%;object-fit:cover">`
                      : `<span style="font-size:24px;color:var(--text-3)">🖼</span>`}
                  </div>
                  <span style="font-size:13px;font-weight:600;color:var(--indigo);text-align:center">
                    ${escHtml(cat.name)}
                  </span>
                </div>
              </div>`).join('')}
          </div>

          <!-- Добавить категорию -->
          <div style="display:flex;gap:8px;margin-bottom:24px">
            <input class="input-field" id="sort-new-cat" placeholder="Название новой корзины" style="max-width:260px">
            <button class="btn btn-ghost btn-sm" id="sort-add-cat">+ Добавить корзину</button>
          </div>

          <div class="divider"></div>

          <!-- Элементы -->
          <div class="editor-section-title" style="margin-top:16px;margin-bottom:12px">Элементы для сортировки</div>
          <div id="sort-items" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px"></div>

          <div class="add-item-row">
            <div style="flex:1;display:flex;flex-direction:column;gap:8px">
              <input class="input-field" id="sort-item-text" placeholder="Текст элемента (необязательно)">
              <div id="sort-item-img-p"></div>
              <button class="btn btn-ghost btn-sm" id="sort-item-img-btn">🖼 Картинка к элементу</button>
              <select class="input-field select-field" id="sort-item-cat">
                <option value="">Правильная корзина...</option>
                ${c.categories.map(cat => `<option value="${escHtml(cat.name)}">${escHtml(cat.name)}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary" id="sort-add-item" style="align-self:flex-end">Добавить</button>
          </div>
        </div>`;

      let newItemImg = '';

      // Клик на картинку категории
      document.querySelectorAll('[data-cat-img-btn]').forEach(wrap => {
        wrap.addEventListener('click', () => {
          const i = +wrap.dataset.catImgBtn;
          pickImage((path, data) => {
            c.categories[i].img = path;
            wrap.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover">`;
          });
        });
      });

      document.getElementById('sort-item-img-btn').addEventListener('click', () => pickImage((p, d) => {
        newItemImg = p;
        document.getElementById('sort-item-img-p').innerHTML =
          `<img src="${d}" style="max-height:70px;border-radius:6px">`;
      }));

      document.getElementById('sort-add-cat').addEventListener('click', () => {
        const val = document.getElementById('sort-new-cat').value.trim();
        if (!val) { toast('Введите название корзины', 'error'); return; }
        if (c.categories.some(cat => cat.name === val)) { toast('Такая корзина уже есть', 'error'); return; }
        c.categories.push({ name: val, img: '' });
        render();
      });

      document.querySelectorAll('.sort-del-cat').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = c.categories[+btn.dataset.i].name;
          // Удаляем элементы этой категории
          c.items = c.items.filter(it => it.category !== name);
          c.categories.splice(+btn.dataset.i, 1);
          render();
        });
      });

      document.getElementById('sort-add-item').addEventListener('click', () => {
        const text = document.getElementById('sort-item-text').value.trim();
        const cat  = document.getElementById('sort-item-cat').value;
        if (!text && !newItemImg) { toast('Введите текст или добавьте картинку', 'error'); return; }
        if (!cat) { toast('Выберите корзину', 'error'); return; }
        c.items.push({ text, img: newItemImg, category: cat });
        newItemImg = '';
        render();
      });

      renderSortItems();
    }

    async function renderSortItems() {
      const container = document.getElementById('sort-items');
      if (!container) return;
      if (!c.items.length) {
        container.innerHTML = `<div style="color:var(--text-3);font-size:13px">Элементов пока нет</div>`;
        return;
      }
      container.innerHTML = c.items.map((it, i) => `
        <div style="display:flex;align-items:center;gap:6px;padding:8px 12px;
          background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md)">
          ${it.img ? `<img data-path="${escHtml(it.img)}" class="lazy-img"
            style="width:38px;height:38px;object-fit:cover;border-radius:6px;flex-shrink:0">` : ''}
          <span style="font-size:13px;font-weight:500;flex:1">${escHtml(it.text)||'—'}</span>
          <span style="font-size:11px;color:var(--indigo);background:var(--indigo-l);
            padding:2px 8px;border-radius:10px;white-space:nowrap">${escHtml(it.category)}</span>
          <button class="sort-del-item" data-i="${i}"
            style="border:none;background:none;cursor:pointer;color:var(--text-3);font-size:16px;
            line-height:1;margin-left:2px;flex-shrink:0">×</button>
        </div>`).join('');

      container.querySelectorAll('.sort-del-item').forEach(btn => {
        btn.addEventListener('click', () => { c.items.splice(+btn.dataset.i, 1); render(); });
      });
      await loadLazyImages(container);
    }

    render();

    document.getElementById('editor-sidebar').innerHTML = `
      <div class="editor-section-title">Как работает</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.7">
        1. Добавьте корзины (категории)<br>
        2. К каждой корзине можно добавить картинку — она будет видна в плеере<br>
        3. Добавьте элементы и укажите для каждого правильную корзину
      </div>
      <div class="divider"></div>
      <div style="font-size:13px">
        Корзин: <b>${c.categories.length}</b><br>
        Элементов: <b>${c.items.length}</b>
      </div>`;
  },
};

window.Editor = Editor;

// ══════════════════════════════════════════════════════════════════════════════
//  РЕДАКТОРЫ НОВЫХ ТИПОВ УПРАЖНЕНИЙ
// ══════════════════════════════════════════════════════════════════════════════

Object.assign(EditorTypes, {

  // ── 5. Последовательность (sequencing) ────────────────────────────────────
  sequencing(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];
    if (!c.instruction) c.instruction = 'Расставь картинки в правильном порядке';

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div class="editor-section-title">Инструкция</div>
        <input class="input-field" id="seq-instruction" value="${escHtml(c.instruction)}"
          style="margin-bottom:18px">

        <div class="editor-section-title">Элементы последовательности
          <span style="font-size:11px;font-weight:400;color:var(--text-3)"> — добавьте от 3 до 6, порядок = правильная последовательность</span>
        </div>

        <div id="seq-items" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="seq-add">+ Добавить элемент</button>`;

      document.getElementById('seq-instruction').addEventListener('input', e => { c.instruction = e.target.value; });

      const container = document.getElementById('seq-items');
      c.items.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.cssText = 'display:flex;gap:10px;align-items:center';
        div.innerHTML = `
          <div class="item-number">${i+1}</div>
          ${item.img
            ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img"
                style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer" title="Сменить">`
            : `<button class="btn btn-ghost btn-sm item-pick-img" data-i="${i}">🖼 Картинка</button>`}
          <input class="input-field" value="${escHtml(item.label||'')}" placeholder="Подпись (необязательно)"
            style="flex:1" data-label="${i}">
          <div style="display:flex;flex-direction:column;gap:3px">
            <button class="btn btn-icon btn-ghost btn-sm seq-up" data-i="${i}" style="opacity:${i===0?.3:1}">↑</button>
            <button class="btn btn-icon btn-ghost btn-sm seq-dn" data-i="${i}" style="opacity:${i===c.items.length-1?.3:1}">↓</button>
          </div>
          <button class="item-delete seq-del" data-i="${i}">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);

      container.querySelectorAll('.item-pick-img').forEach(btn => {
        btn.addEventListener('click', () => {
          pickImage((path, url) => {
            c.items[+btn.dataset.i].img = path;
            render();
          });
        });
      });
      container.querySelectorAll('.lazy-img').forEach(img => {
        img.addEventListener('click', () => {
          const i = [...container.querySelectorAll('.lazy-img')].indexOf(img);
          pickImage((path) => { c.items[i].img = path; render(); });
        });
      });
      container.querySelectorAll('[data-label]').forEach(inp => {
        inp.addEventListener('input', e => { c.items[+inp.dataset.label].label = e.target.value; });
      });
      container.querySelectorAll('.seq-up').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.i;
          if (i > 0) { [c.items[i-1], c.items[i]] = [c.items[i], c.items[i-1]]; render(); }
        });
      });
      container.querySelectorAll('.seq-dn').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.i;
          if (i < c.items.length-1) { [c.items[i], c.items[i+1]] = [c.items[i+1], c.items[i]]; render(); }
        });
      });
      container.querySelectorAll('.seq-del').forEach(btn => {
        btn.addEventListener('click', () => { c.items.splice(+btn.dataset.i, 1); render(); });
      });
      document.getElementById('seq-add').addEventListener('click', () => {
        if (c.items.length >= 6) { toast('Максимум 6 элементов', 'error'); return; }
        c.items.push({ label: '', img: '' });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('sequencing');
  },

  // ── 6. Память (memory) ────────────────────────────────────────────────────
  memory(editor) {
    const c = editor._content;
    if (!c.pairs) c.pairs = [];
    if (!c.flips) c.flips = 2; // сколько попыток на пару открытия

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div class="editor-section-title">Пары карточек
          <span style="font-size:11px;font-weight:400;color:var(--text-3)"> — 3–8 пар, у каждой пары 2 одинаковые стороны</span>
        </div>

        <div id="mem-pairs" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="mem-add">+ Добавить пару</button>`;

      const container = document.getElementById('mem-pairs');
      c.pairs.forEach((pair, i) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.cssText = 'display:flex;gap:12px;align-items:center';
        div.innerHTML = `
          <div class="item-number">${i+1}</div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            ${pair.img ? `<img src="" data-path="${escHtml(pair.img)}" class="lazy-img"
              style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer">`
              : `<button class="btn btn-ghost btn-sm mem-pick" data-i="${i}">🖼 Картинка</button>`}
          </div>
          <div style="font-size:20px;color:var(--text-3)">×2</div>
          <input class="input-field" value="${escHtml(pair.label||'')}" placeholder="Подпись / текст карточки"
            style="flex:1" data-pair="${i}">
          <button class="item-delete mem-del" data-i="${i}">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);

      container.querySelectorAll('.mem-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          pickImage((path) => { c.pairs[+btn.dataset.i].img = path; render(); });
        });
      });
      container.querySelectorAll('.lazy-img').forEach((img, i) => {
        img.addEventListener('click', () => pickImage(path => { c.pairs[i].img = path; render(); }));
      });
      container.querySelectorAll('[data-pair]').forEach(inp => {
        inp.addEventListener('input', e => { c.pairs[+inp.dataset.pair].label = e.target.value; });
      });
      container.querySelectorAll('.mem-del').forEach(btn => {
        btn.addEventListener('click', () => { c.pairs.splice(+btn.dataset.i, 1); render(); });
      });
      document.getElementById('mem-add').addEventListener('click', () => {
        if (c.pairs.length >= 8) { toast('Максимум 8 пар', 'error'); return; }
        c.pairs.push({ label: '', img: '' });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('memory');
  },

  // ── 7. Что исчезло? (whats_missing) ──────────────────────────────────────
  whats_missing(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];
    if (!c.showTime) c.showTime = 4; // секунды показа

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:18px">
          <div class="editor-section-title" style="margin:0">Время показа набора</div>
          <select class="input-field select-field" id="wm-time" style="width:160px">
            <option value="3" ${c.showTime==3?'selected':''}>3 секунды</option>
            <option value="4" ${c.showTime==4?'selected':''}>4 секунды</option>
            <option value="6" ${c.showTime==6?'selected':''}>6 секунд</option>
            <option value="10" ${c.showTime==10?'selected':''}>10 секунд</option>
          </select>
        </div>

        <div class="editor-section-title">Набор предметов
          <span style="font-size:11px;font-weight:400;color:var(--text-3)"> — добавьте 4–8, один случайно исчезнет</span>
        </div>
        <div id="wm-items" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="wm-add">+ Добавить предмет</button>`;

      document.getElementById('wm-time').addEventListener('change', e => { c.showTime = +e.target.value; });

      const container = document.getElementById('wm-items');
      c.items.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:10px';
        div.innerHTML = `
          ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img"
            style="width:72px;height:72px;object-fit:cover;border-radius:8px;cursor:pointer">`
            : `<button class="btn btn-ghost btn-sm wm-pick" data-i="${i}" style="width:72px;height:72px">🖼</button>`}
          <input class="input-field wm-label" data-i="${i}" value="${escHtml(item.label||'')}"
            placeholder="Название" style="width:90px;font-size:12px;text-align:center">
          <button class="btn btn-icon btn-ghost btn-sm wm-del" data-i="${i}" style="color:var(--rose)">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);
      container.querySelectorAll('.wm-pick').forEach(btn => {
        btn.addEventListener('click', () => pickImage(path => { c.items[+btn.dataset.i].img = path; render(); }));
      });
      container.querySelectorAll('.lazy-img').forEach((img, i) => {
        img.addEventListener('click', () => pickImage(path => { c.items[i].img = path; render(); }));
      });
      container.querySelectorAll('.wm-label').forEach(inp => {
        inp.addEventListener('input', e => { c.items[+inp.dataset.i].label = e.target.value; });
      });
      container.querySelectorAll('.wm-del').forEach(btn => {
        btn.addEventListener('click', () => { c.items.splice(+btn.dataset.i, 1); render(); });
      });
      document.getElementById('wm-add').addEventListener('click', () => {
        if (c.items.length >= 8) { toast('Максимум 8 предметов', 'error'); return; }
        c.items.push({ label: '', img: '' });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('whats_missing');
  },

  // ── 8. Считаем (counting) ─────────────────────────────────────────────────
  counting(editor) {
    const c = editor._content;
    if (!c.tasks) c.tasks = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div class="editor-section-title">Задания на счёт</div>
        <div id="cnt-tasks" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="cnt-add">+ Добавить задание</button>`;

      const container = document.getElementById('cnt-tasks');
      c.tasks.forEach((task, i) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.cssText = 'display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap';
        div.innerHTML = `
          <div class="item-number">${i+1}</div>
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:200px">
            <input class="input-field" value="${escHtml(task.question||'')}" placeholder="Вопрос: «Сколько яблок?»"
              data-q="${i}">
            <div style="display:flex;gap:8px;align-items:center">
              ${task.img ? `<img src="" data-path="${escHtml(task.img)}" class="lazy-img"
                style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer">`
                : `<button class="btn btn-ghost btn-sm cnt-pick" data-i="${i}">🖼 Картинка</button>`}
              <div style="display:flex;flex-direction:column;gap:6px">
                <label class="form-label">Правильный ответ</label>
                <input class="input-field" type="number" min="0" max="20" value="${task.answer??''}"
                  placeholder="Число" style="width:80px" data-ans="${i}">
                <label class="form-label">Диапазон вариантов</label>
                <div style="display:flex;gap:6px">
                  <input class="input-field" type="number" min="0" max="20" value="${task.minOpt??0}"
                    style="width:60px" placeholder="от" data-min="${i}">
                  <input class="input-field" type="number" min="0" max="20" value="${task.maxOpt??5}"
                    style="width:60px" placeholder="до" data-max="${i}">
                </div>
              </div>
            </div>
          </div>
          <button class="item-delete cnt-del" data-i="${i}">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);
      container.querySelectorAll('.cnt-pick').forEach(btn => {
        btn.addEventListener('click', () => pickImage(path => { c.tasks[+btn.dataset.i].img = path; render(); }));
      });
      container.querySelectorAll('.lazy-img').forEach((img, i) => {
        img.addEventListener('click', () => pickImage(path => { c.tasks[i].img = path; render(); }));
      });
      container.querySelectorAll('[data-q]').forEach(inp => { inp.addEventListener('input', e => { c.tasks[+inp.dataset.q].question = e.target.value; }); });
      container.querySelectorAll('[data-ans]').forEach(inp => { inp.addEventListener('input', e => { c.tasks[+inp.dataset.ans].answer = parseInt(e.target.value); }); });
      container.querySelectorAll('[data-min]').forEach(inp => { inp.addEventListener('input', e => { c.tasks[+inp.dataset.min].minOpt = parseInt(e.target.value)||0; }); });
      container.querySelectorAll('[data-max]').forEach(inp => { inp.addEventListener('input', e => { c.tasks[+inp.dataset.max].maxOpt = parseInt(e.target.value)||5; }); });
      container.querySelectorAll('.cnt-del').forEach(btn => { btn.addEventListener('click', () => { c.tasks.splice(+btn.dataset.i, 1); render(); }); });
      document.getElementById('cnt-add').addEventListener('click', () => {
        c.tasks.push({ question: '', img: '', answer: 3, minOpt: 1, maxOpt: 6 });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('counting');
  },

  // ── 9. Разложи по группам (categories) ───────────────────────────────────
  categories(editor) {
    const c = editor._content;
    if (!c.categories) c.categories = [{ name: 'Группа 1', items: [] }, { name: 'Группа 2', items: [] }];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div class="editor-section-title">Категории и их предметы</div>
        <div id="cat-groups" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px"></div>
        ${c.categories.length < 3 ? `<button class="btn btn-ghost btn-sm" id="cat-add-group">+ Добавить 3-ю группу</button>` : ''}`;

      const groups = document.getElementById('cat-groups');
      c.categories.forEach((cat, gi) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:16px';
        div.innerHTML = `
          <input class="input-field" value="${escHtml(cat.name)}" placeholder="Название группы"
            style="margin-bottom:12px;font-weight:700" data-gname="${gi}">
          <div style="display:flex;flex-direction:column;gap:8px" id="cat-items-${gi}"></div>
          <button class="btn btn-ghost btn-sm cat-add-item" data-gi="${gi}" style="margin-top:8px">+ Предмет</button>`;
        groups.appendChild(div);

        const itemsContainer = div.querySelector(`#cat-items-${gi}`);
        cat.items.forEach((item, ii) => {
          const iDiv = document.createElement('div');
          iDiv.style.cssText = 'display:flex;gap:8px;align-items:center';
          iDiv.innerHTML = `
            ${item.img
              ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img"
                  style="width:44px;height:44px;object-fit:cover;border-radius:6px;cursor:pointer" data-gi="${gi}" data-ii="${ii}">`
              : `<button class="btn btn-ghost btn-sm cat-pick" data-gi="${gi}" data-ii="${ii}" style="width:44px;height:44px;padding:4px">🖼</button>`}
            <input class="input-field cat-ilabel" data-gi="${gi}" data-ii="${ii}"
              value="${escHtml(item.label||'')}" placeholder="Название" style="flex:1;font-size:12.5px">
            <button class="item-delete cat-del-item" data-gi="${gi}" data-ii="${ii}">×</button>`;
          itemsContainer.appendChild(iDiv);
        });
      });

      loadLazyImages(groups);

      groups.querySelectorAll('[data-gname]').forEach(inp => {
        inp.addEventListener('input', e => { c.categories[+inp.dataset.gname].name = e.target.value; });
      });
      groups.querySelectorAll('.cat-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          pickImage(path => { c.categories[+btn.dataset.gi].items[+btn.dataset.ii].img = path; render(); });
        });
      });
      groups.querySelectorAll('.lazy-img[data-gi]').forEach(img => {
        img.addEventListener('click', () => {
          pickImage(path => { c.categories[+img.dataset.gi].items[+img.dataset.ii].img = path; render(); });
        });
      });
      groups.querySelectorAll('.cat-ilabel').forEach(inp => {
        inp.addEventListener('input', e => { c.categories[+inp.dataset.gi].items[+inp.dataset.ii].label = e.target.value; });
      });
      groups.querySelectorAll('.cat-add-item').forEach(btn => {
        btn.addEventListener('click', () => { c.categories[+btn.dataset.gi].items.push({ label:'', img:'' }); render(); });
      });
      groups.querySelectorAll('.cat-del-item').forEach(btn => {
        btn.addEventListener('click', () => { c.categories[+btn.dataset.gi].items.splice(+btn.dataset.ii, 1); render(); });
      });
      document.getElementById('cat-add-group')?.addEventListener('click', () => {
        c.categories.push({ name: 'Группа 3', items: [] }); render();
      });
    }
    render();
    EditorTypes._sidebarHint('categories');
  },

  // ── 10. Верно / Неверно (true_false) ─────────────────────────────────────
  true_false(editor) {
    const c = editor._content;
    if (!c.statements) c.statements = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div class="editor-section-title">Утверждения</div>
        <div id="tf-stmts" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="tf-add">+ Добавить утверждение</button>`;

      const container = document.getElementById('tf-stmts');
      c.statements.forEach((stmt, i) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.cssText = 'display:flex;gap:12px;align-items:flex-start';
        div.innerHTML = `
          <div class="item-number">${i+1}</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px">
            <input class="input-field" value="${escHtml(stmt.text||'')}" placeholder="Утверждение: «Кошка — это рыба»"
              data-t="${i}">
            ${stmt.img ? `<img src="" data-path="${escHtml(stmt.img)}" class="lazy-img"
              style="height:80px;object-fit:contain;border-radius:8px;cursor:pointer">`
              : `<button class="btn btn-ghost btn-sm tf-pick" data-i="${i}">🖼 Добавить картинку (необязательно)</button>`}
            <div style="display:flex;gap:8px">
              <button class="btn tf-ans ${stmt.correct===true?'btn-success':''}" data-i="${i}" data-val="true"
                style="flex:1;padding:8px;border-radius:var(--r-md);font-size:13px;font-weight:700;
                  border:2px solid ${stmt.correct===true?'var(--green)':'var(--border)'};
                  background:${stmt.correct===true?'var(--green-l)':'var(--surface)'};
                  color:${stmt.correct===true?'var(--green)':'var(--text-2)'}">✅ Верно</button>
              <button class="btn tf-ans ${stmt.correct===false?'selected':''}" data-i="${i}" data-val="false"
                style="flex:1;padding:8px;border-radius:var(--r-md);font-size:13px;font-weight:700;
                  border:2px solid ${stmt.correct===false?'var(--rose)':'var(--border)'};
                  background:${stmt.correct===false?'var(--rose-l)':'var(--surface)'};
                  color:${stmt.correct===false?'var(--rose)':'var(--text-2)'}">❌ Неверно</button>
            </div>
          </div>
          <button class="item-delete tf-del" data-i="${i}">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);
      container.querySelectorAll('[data-t]').forEach(inp => {
        inp.addEventListener('input', e => { c.statements[+inp.dataset.t].text = e.target.value; });
      });
      container.querySelectorAll('.tf-pick').forEach(btn => {
        btn.addEventListener('click', () => pickImage(path => { c.statements[+btn.dataset.i].img = path; render(); }));
      });
      container.querySelectorAll('.lazy-img').forEach((img, i) => {
        img.addEventListener('click', () => pickImage(path => { c.statements[i].img = path; render(); }));
      });
      container.querySelectorAll('.tf-ans').forEach(btn => {
        btn.addEventListener('click', () => {
          c.statements[+btn.dataset.i].correct = btn.dataset.val === 'true'; render();
        });
      });
      container.querySelectorAll('.tf-del').forEach(btn => {
        btn.addEventListener('click', () => { c.statements.splice(+btn.dataset.i, 1); render(); });
      });
      document.getElementById('tf-add').addEventListener('click', () => {
        c.statements.push({ text: '', img: '', correct: true }); render();
      });
    }
    render();
    EditorTypes._sidebarHint('true_false');
  },

  // ── 11. Составь слово (word_builder) ─────────────────────────────────────
  word_builder(editor) {
    const c = editor._content;
    if (!c.words) c.words = [];

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div class="editor-section-title">Слова для составления</div>
        <div id="wb-words" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="wb-add">+ Добавить слово</button>`;

      const container = document.getElementById('wb-words');
      c.words.forEach((word, i) => {
        const letters = word.text ? word.text.toUpperCase().split('').join(' · ') : '—';
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.cssText = 'display:flex;gap:12px;align-items:center';
        div.innerHTML = `
          <div class="item-number">${i+1}</div>
          ${word.img ? `<img src="" data-path="${escHtml(word.img)}" class="lazy-img"
            style="width:72px;height:72px;object-fit:cover;border-radius:8px;cursor:pointer">`
            : `<button class="btn btn-ghost btn-sm wb-pick" data-i="${i}" style="width:72px;height:72px">🖼 Подсказка</button>`}
          <div style="flex:1">
            <input class="input-field wb-word" data-i="${i}" value="${escHtml(word.text||'')}"
              placeholder="Слово (например: КОТ)">
            ${word.text ? `<div style="margin-top:6px;font-size:11px;color:var(--text-3)">Буквы: ${escHtml(letters)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <label class="form-label" style="font-size:11px">Сложность</label>
            <select class="input-field select-field" style="font-size:12px;padding:4px 8px" data-diff="${i}">
              <option value="easy" ${word.mode==='easy'?'selected':''}>Перетаскивание</option>
              <option value="hard" ${word.mode==='hard'?'selected':''}>Только нажатие</option>
            </select>
          </div>
          <button class="item-delete wb-del" data-i="${i}">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);
      container.querySelectorAll('.wb-pick').forEach(btn => {
        btn.addEventListener('click', () => pickImage(path => { c.words[+btn.dataset.i].img = path; render(); }));
      });
      container.querySelectorAll('.lazy-img').forEach((img, i) => {
        img.addEventListener('click', () => pickImage(path => { c.words[i].img = path; render(); }));
      });
      container.querySelectorAll('.wb-word').forEach(inp => {
        inp.addEventListener('input', e => { c.words[+inp.dataset.i].text = e.target.value.toUpperCase(); render(); });
      });
      container.querySelectorAll('[data-diff]').forEach(sel => {
        sel.addEventListener('change', e => { c.words[+sel.dataset.diff].mode = e.target.value; });
      });
      container.querySelectorAll('.wb-del').forEach(btn => {
        btn.addEventListener('click', () => { c.words.splice(+btn.dataset.i, 1); render(); });
      });
      document.getElementById('wb-add').addEventListener('click', () => {
        c.words.push({ text: '', img: '', mode: 'easy' }); render();
      });
    }
    render();
    EditorTypes._sidebarHint('word_builder');
  },

  // ── 12. По размеру (size_order) ───────────────────────────────────────────
  size_order(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];
    if (!c.direction) c.direction = 'asc'; // asc = от маленького к большому
    if (!c.instruction) c.instruction = 'Расставь от меньшего к большему';

    function render() {
      const main = document.getElementById('editor-main');
      main.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:200px">
            <label class="form-label">Инструкция</label>
            <input class="input-field" id="so-instr" value="${escHtml(c.instruction)}">
          </div>
          <div class="form-group">
            <label class="form-label">Направление</label>
            <select class="input-field select-field" id="so-dir">
              <option value="asc"  ${c.direction==='asc' ?'selected':''}>От меньшего к большему</option>
              <option value="desc" ${c.direction==='desc'?'selected':''}>От большего к меньшему</option>
            </select>
          </div>
        </div>

        <div class="editor-section-title">Элементы
          <span style="font-size:11px;font-weight:400;color:var(--text-3)"> — порядок в списке = правильный порядок по размеру</span>
        </div>
        <div id="so-items" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-ghost btn-sm" id="so-add">+ Добавить элемент</button>`;

      document.getElementById('so-instr').addEventListener('input', e => { c.instruction = e.target.value; });
      document.getElementById('so-dir').addEventListener('change', e => { c.direction = e.target.value; });

      const container = document.getElementById('so-items');
      c.items.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.cssText = 'display:flex;gap:12px;align-items:center';
        div.innerHTML = `
          <div class="item-number">${i+1}</div>
          ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="lazy-img"
            style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer">`
            : `<button class="btn btn-ghost btn-sm so-pick" data-i="${i}">🖼 Картинка</button>`}
          <input class="input-field" value="${escHtml(item.label||'')}" placeholder="Подпись" data-label="${i}" style="flex:1">
          <div style="display:flex;flex-direction:column;gap:3px">
            <button class="btn btn-icon btn-ghost btn-sm so-up" data-i="${i}" style="opacity:${i===0?.3:1}">↑</button>
            <button class="btn btn-icon btn-ghost btn-sm so-dn" data-i="${i}" style="opacity:${i===c.items.length-1?.3:1}">↓</button>
          </div>
          <button class="item-delete so-del" data-i="${i}">×</button>`;
        container.appendChild(div);
      });

      loadLazyImages(container);
      container.querySelectorAll('.so-pick').forEach(btn => {
        btn.addEventListener('click', () => pickImage(path => { c.items[+btn.dataset.i].img = path; render(); }));
      });
      container.querySelectorAll('.lazy-img').forEach((img, i) => {
        img.addEventListener('click', () => pickImage(path => { c.items[i].img = path; render(); }));
      });
      container.querySelectorAll('[data-label]').forEach(inp => {
        inp.addEventListener('input', e => { c.items[+inp.dataset.label].label = e.target.value; });
      });
      container.querySelectorAll('.so-up').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.i;
          if (i > 0) { [c.items[i-1], c.items[i]] = [c.items[i], c.items[i-1]]; render(); }
        });
      });
      container.querySelectorAll('.so-dn').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.i;
          if (i < c.items.length-1) { [c.items[i], c.items[i+1]] = [c.items[i+1], c.items[i]]; render(); }
        });
      });
      container.querySelectorAll('.so-del').forEach(btn => {
        btn.addEventListener('click', () => { c.items.splice(+btn.dataset.i, 1); render(); });
      });
      document.getElementById('so-add').addEventListener('click', () => {
        if (c.items.length >= 6) { toast('Максимум 6 элементов', 'error'); return; }
        c.items.push({ label: '', img: '' }); render();
      });
    }
    render();
    EditorTypes._sidebarHint('size_order');
  },

  // ── Подсказки в сайдбаре ─────────────────────────────────────────────────
  _sidebarHint(type) {
    const sb = document.getElementById('editor-sidebar');
    if (!sb) return;
    const hints = {
      sequencing:    ['Порядок имеет значение', 'Добавьте 3–6 элементов с картинками. В плеере они будут перемешаны, задача — восстановить порядок.'],
      memory:        ['Классическая игра', 'Карточки раскладываются рубашкой вниз. Нужно найти все одинаковые пары.'],
      find_pairs:    ['Соедини линиями', 'Правый столбец перемешивается. Ученик нажимает объект слева, затем его пару справа — они соединяются линией. Добавьте 3–7 пар.'],
      whats_missing: ['Тренировка памяти', 'Ребёнок видит все предметы несколько секунд, затем один исчезает. Задача — назвать, что пропало.'],
      counting:      ['Счёт предметов', 'Показывается картинка, нужно выбрать правильное число. Задайте диапазон вариантов ответа.'],
      categories:    ['Классификация', 'Ребёнок перетаскивает предметы в нужные группы. Хорошо для изучения категорий.'],
      true_false:    ['Верно / Неверно', 'Покажите утверждение (с картинкой или без). Ребёнок выбирает — правда или нет.'],
      word_builder:  ['Собери слово', 'Буквы перемешаны, нужно нажимать в правильном порядке. Используйте картинку как подсказку.'],
      size_order:    ['По размеру', 'Порядок в редакторе — это правильный ответ. Добавьте картинки предметов разного размера.'],
    };
    const [title, text] = hints[type] || ['Редактор', 'Добавьте элементы.'];
    sb.innerHTML = `
      <div class="editor-section-title">Совет</div>
      <div style="background:var(--indigo-l);border-radius:var(--r-lg);padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:var(--indigo);margin-bottom:6px">${title}</div>
        <div style="font-size:12.5px;color:var(--indigo);opacity:.85;line-height:1.6">${text}</div>
      </div>`;
  },
});



// ══════════════════════════════════════════════════════════════════════════════
//  РЕДАКТОРЫ ОСТАВШИХСЯ ТИПОВ
//  pattern, story_order, word_to_pic, fill_blank, first_sound, compare, emotion_match
// ══════════════════════════════════════════════════════════════════════════════
Object.assign(EditorTypes, {

  // ── Продолжи ряд (pattern) ─────────────────────────────────────────────────
  // content: { sequences: [{items:[], options:[], answer:0}] }
  pattern(editor) {
    const c = editor._content;
    if (!c.sequences) c.sequences = [];
    if (!c.mode) c.mode = 'text';
    const container = editor._bodyEl;

    function render() {
      const isImg = c.mode === 'image';
      container.innerHTML = `
        <div style="max-width:700px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <div style="font-size:13.5px;font-weight:600;color:var(--text-2)">Режим:</div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13.5px">
              <input type="radio" name="pat-mode" value="text" ${!isImg ? 'checked' : ''}> Текст / числа
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13.5px">
              <input type="radio" name="pat-mode" value="image" ${isImg ? 'checked' : ''}> Картинки
            </label>
          </div>
          <div id="pat-list"></div>
          <button class="btn btn-ghost btn-sm" id="pat-add" style="margin-top:10px">+ Добавить ряд</button>
        </div>`;

      container.querySelectorAll('input[name=pat-mode]').forEach(r => {
        r.addEventListener('change', e => { c.mode = e.target.value; render(); });
      });

      const list = container.querySelector('#pat-list');

      if (!isImg) {
        // ── Текстовый режим ───────────────────────────────────────────────────
        c.sequences.forEach((seq, si) => {
          const div = document.createElement('div');
          div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:16px;margin-bottom:12px;position:relative';
          div.innerHTML = `
            <button class="item-delete" data-si="${si}" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Ряд (через запятую): <span style="color:var(--text-3)">напр. 1,2,3,4</span></label>
              <input class="input-field pat-items" data-si="${si}" value="${escHtml((seq.items||[]).join(','))}" placeholder="1, 2, 3, 4">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Варианты ответа (через запятую)</label>
              <input class="input-field pat-opts" data-si="${si}" value="${escHtml((seq.options||[]).join(','))}" placeholder="5, 6, 7">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Правильный вариант (индекс из вариантов, начиная с 0)</label>
              <input class="input-field" type="number" min="0" max="9" data-si="${si}" value="${seq.answer ?? 0}" style="width:80px">
            </div>`;
          list.appendChild(div);
          div.querySelector('.pat-items').addEventListener('input', e => {
            c.sequences[si].items = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
          });
          div.querySelector('.pat-opts').addEventListener('input', e => {
            c.sequences[si].options = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
          });
          div.querySelector('[type=number]').addEventListener('input', e => {
            c.sequences[si].answer = parseInt(e.target.value) || 0;
          });
          div.querySelector('.item-delete').addEventListener('click', () => {
            c.sequences.splice(si, 1); render();
          });
        });
        container.querySelector('#pat-add').addEventListener('click', () => {
          c.sequences.push({ items: ['1','2','3'], options: ['4','5','6'], answer: 0 });
          render();
        });

      } else {
        // ── Режим картинок ────────────────────────────────────────────────────
        c.sequences.forEach((seq, si) => {
          if (!seq.items) seq.items = [];
          if (!seq.options) seq.options = [];
          if (seq.gap_index == null) seq.gap_index = seq.items.length - 1;

          const div = document.createElement('div');
          div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:16px;margin-bottom:14px;position:relative';
          div.innerHTML = `
            <button class="item-delete pat-del-seq" data-si="${si}" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
            <div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:10px">РЯД ${si + 1}</div>

            <div style="font-size:12px;color:var(--text-3);margin-bottom:6px">
              Элементы ряда — <span style="color:var(--rose)">один будет скрыт (пропуск)</span>:
            </div>
            <div class="pat-img-items" data-si="${si}" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px"></div>
            <button class="btn btn-ghost btn-sm pat-add-item" data-si="${si}">+ Добавить элемент ряда</button>

            <div style="font-size:12px;color:var(--text-3);margin:12px 0 6px">Варианты ответа (какой из них правильный?):</div>
            <div class="pat-img-opts" data-si="${si}" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>
            <button class="btn btn-ghost btn-sm pat-add-opt" data-si="${si}">+ Добавить вариант</button>

            <div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <label style="font-size:12px;color:var(--text-2)">Индекс пропуска (0 = первый):</label>
              <input class="input-field pat-gap" data-si="${si}" type="number" min="0" value="${seq.gap_index}" style="width:70px">
              <label style="font-size:12px;color:var(--text-2)">Правильный вариант (индекс, 0 = первый):</label>
              <input class="input-field pat-ans-img" data-si="${si}" type="number" min="0" value="${seq.answer ?? 0}" style="width:70px">
            </div>`;
          list.appendChild(div);

          // Render item thumbnails
          function renderImgItems() {
            const wrap = div.querySelector('.pat-img-items');
            wrap.innerHTML = (seq.items || []).map((it, ii) => `
              <div style="position:relative;text-align:center">
                ${it.img ? `<img data-path="${escHtml(it.img)}" class="lazy-img" style="height:60px;border-radius:6px;display:block">` : '<div style="width:60px;height:60px;border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-3)">нет</div>'}
                <div style="font-size:11px;color:var(--text-2);margin-top:2px">${escHtml(it.label||'')}</div>
                <button class="pat-rm-item" data-si="${si}" data-ii="${ii}"
                  style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--rose);color:#fff;border:none;cursor:pointer;font-size:10px;line-height:18px;text-align:center">✕</button>
                <button class="btn btn-ghost" data-si="${si}" data-ii="${ii}" style="font-size:10px;padding:2px 6px;margin-top:2px" class="pat-edit-item">🖼</button>
              </div>`).join('');
            wrap.querySelectorAll('.pat-rm-item').forEach(b => {
              b.onclick = () => { seq.items.splice(+b.dataset.ii, 1); renderImgItems(); };
            });
            wrap.querySelectorAll('button:not(.pat-rm-item)').forEach(b => {
              b.onclick = () => pickImage((p, d) => {
                seq.items[+b.dataset.ii].img = p;
                renderImgItems();
              });
            });
            loadLazyImages(wrap);
          }

          function renderImgOpts() {
            const wrap = div.querySelector('.pat-img-opts');
            wrap.innerHTML = (seq.options || []).map((op, oi) => `
              <div style="position:relative;text-align:center">
                ${op.img ? `<img data-path="${escHtml(op.img)}" class="lazy-img" style="height:60px;border-radius:6px;display:block">` : '<div style="width:60px;height:60px;border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-3)">нет</div>'}
                <div style="font-size:11px;color:var(--text-2);margin-top:2px">${escHtml(op.label||'')}</div>
                <button class="pat-rm-opt" data-si="${si}" data-oi="${oi}"
                  style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--rose);color:#fff;border:none;cursor:pointer;font-size:10px;line-height:18px;text-align:center">✕</button>
                <button class="pat-edit-opt" data-si="${si}" data-oi="${oi}" style="font-size:10px;padding:2px 6px;margin-top:2px">🖼</button>
              </div>`).join('');
            wrap.querySelectorAll('.pat-rm-opt').forEach(b => {
              b.onclick = () => { seq.options.splice(+b.dataset.oi, 1); renderImgOpts(); };
            });
            wrap.querySelectorAll('.pat-edit-opt').forEach(b => {
              b.onclick = () => pickImage((p, d) => {
                seq.options[+b.dataset.oi].img = p;
                renderImgOpts();
              });
            });
            loadLazyImages(wrap);
          }

          renderImgItems();
          renderImgOpts();

          div.querySelector('.pat-add-item').onclick = () => {
            pickImage((p, d) => {
              seq.items.push({ img: p, label: '' });
              renderImgItems();
            });
          };
          div.querySelector('.pat-add-opt').onclick = () => {
            pickImage((p, d) => {
              seq.options.push({ img: p, label: '' });
              renderImgOpts();
            });
          };
          div.querySelector('.pat-gap').addEventListener('input', e => {
            seq.gap_index = parseInt(e.target.value) || 0;
          });
          div.querySelector('.pat-ans-img').addEventListener('input', e => {
            seq.answer = parseInt(e.target.value) || 0;
          });
          div.querySelector('.pat-del-seq').addEventListener('click', () => {
            c.sequences.splice(si, 1); render();
          });
        });

        container.querySelector('#pat-add').addEventListener('click', () => {
          c.sequences.push({ items: [], gap_index: 0, options: [], answer: 0 });
          render();
        });
      }
    }

    render();
    EditorTypes._sidebarHint('pattern');
  },

  // ── История по порядку (story_order) ───────────────────────────────────────
  // content: { items: [{label, img}] }  — delegate to sequencing editor UI
  story_order(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];
    const container = editor._bodyEl;

    function render() {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Кадры истории (в правильном порядке)</label>
          <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Ученик будет расставлять их в нужной последовательности</div>
          <div id="so-list"></div>
          <button class="btn btn-ghost btn-sm" id="so-add" style="margin-top:10px">+ Добавить кадр</button>
        </div>`;

      const list = container.querySelector('#so-list');
      c.items.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:14px;margin-bottom:10px;position:relative;display:flex;gap:12px;align-items:flex-start';
        div.innerHTML = `
          <div style="font-size:14px;font-weight:700;color:var(--indigo);min-width:20px;margin-top:4px">${i+1}</div>
          <div style="flex:1">
            <input class="input-field so-label" data-i="${i}" value="${escHtml(item.label||item.text||'')}" placeholder="Описание кадра" style="margin-bottom:8px">
            <div class="img-picker-wrap" data-i="${i}">
              ${item.img ? `<img src="" data-path="${escHtml(item.img)}" class="img-picker-thumb lazy-img" style="height:80px;object-fit:contain;border-radius:var(--r-md);margin-bottom:6px">` : ''}
              <button class="btn btn-ghost btn-sm so-img" data-i="${i}">🖼 ${item.img ? 'Сменить' : 'Добавить'} картинку</button>
            </div>
          </div>
          <button class="item-delete" data-i="${i}" style="opacity:1">✕</button>`;
        list.appendChild(div);
        div.querySelector('.so-label').addEventListener('input', e => { c.items[i].label = e.target.value; });
        div.querySelector('.so-img').addEventListener('click', async () => {
          const p = await window.db.files.pickImage();
          if (p) { c.items[i].img = p; render(); }
        });
        div.querySelector('.item-delete').addEventListener('click', () => { c.items.splice(i,1); render(); });
      });
      loadLazyImages(list);
      container.querySelector('#so-add').addEventListener('click', () => { c.items.push({label:'',img:''}); render(); });
    }
    render();
    EditorTypes._sidebarHint('story_order');
  },

  // ── Слово → картинка (word_to_pic) ─────────────────────────────────────────
  // content: { items: [{word, pics:[{image, text, correct}]}] }
  word_to_pic(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];
    const container = editor._bodyEl;

    function render() {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Слова и картинки</label>
          <div id="wtp-list"></div>
          <button class="btn btn-ghost btn-sm" id="wtp-add" style="margin-top:10px">+ Добавить слово</button>
        </div>`;

      const list = container.querySelector('#wtp-list');
      c.items.forEach((task, ti) => {
        if (!task.pics) task.pics = [{image:'',text:'',correct:true},{image:'',text:'',correct:false},{image:'',text:'',correct:false}];
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:14px;margin-bottom:12px;position:relative';
        div.innerHTML = `
          <button class="item-delete" data-ti="${ti}" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
          <div class="form-group">
            <label class="form-label" style="font-size:12px">Слово</label>
            <input class="input-field wtp-word" data-ti="${ti}" value="${escHtml(task.word||'')}" placeholder="Например: КОТ">
          </div>
          <div class="form-label" style="font-size:12px;margin-bottom:8px">Картинки (отметьте правильную):</div>
          <div class="wtp-pics" data-ti="${ti}" style="display:flex;flex-wrap:wrap;gap:10px"></div>
          <button class="btn btn-ghost btn-sm wtp-add-pic" data-ti="${ti}" style="margin-top:8px">+ Картинка</button>`;
        list.appendChild(div);

        div.querySelector('.wtp-word').addEventListener('input', e => { c.items[ti].word = e.target.value; });
        div.querySelector('.item-delete').addEventListener('click', () => { c.items.splice(ti,1); render(); });

        const picsWrap = div.querySelector('.wtp-pics');
        task.pics.forEach((pic, pi) => {
          const pd = document.createElement('div');
          pd.style.cssText = 'background:var(--surface);border:2px solid '+(pic.correct?'var(--green)':'var(--border)')+';border-radius:var(--r-lg);padding:10px;text-align:center;min-width:80px';
          pd.innerHTML = `
            ${pic.image ? `<img src="" data-path="${escHtml(pic.image)}" class="lazy-img" style="height:60px;object-fit:contain;border-radius:var(--r-md);display:block;margin:0 auto 6px">` : '<div style="height:60px;display:flex;align-items:center;justify-content:center;color:var(--text-3)">🖼</div>'}
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;margin-bottom:4px">Выбрать</button><br>
            <label style="font-size:11px;cursor:pointer"><input type="radio" name="wtp-correct-${ti}" ${pic.correct?'checked':''}> Правильная</label>
            <button class="btn btn-ghost btn-sm" style="color:var(--rose);font-size:10px;padding:2px 4px">✕</button>`;
          pd.querySelector('button:first-of-type').addEventListener('click', async () => {
            const p = await window.db.files.pickImage(); if (p) { task.pics[pi].image = p; render(); }
          });
          pd.querySelector('input[type=radio]').addEventListener('change', () => {
            task.pics.forEach((p,i) => p.correct = (i===pi));
            render();
          });
          pd.querySelector('button:last-of-type').addEventListener('click', () => { task.pics.splice(pi,1); render(); });
          picsWrap.appendChild(pd);
        });
        loadLazyImages(picsWrap);

        div.querySelector('.wtp-add-pic').addEventListener('click', async () => {
          const p = await window.db.files.pickImage();
          task.pics.push({ image: p||'', text:'', correct: task.pics.length===0 });
          render();
        });
      });

      container.querySelector('#wtp-add').addEventListener('click', () => {
        c.items.push({ word:'', pics:[{image:'',text:'',correct:true},{image:'',text:'',correct:false}] });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('word_to_pic');
  },

  // ── Вставь слово (fill_blank) ───────────────────────────────────────────────
  // content: { sentences: [{text, correct, options:[]}] }
  fill_blank(editor) {
    const c = editor._content;
    if (!c.sentences) c.sentences = [];
    const container = editor._bodyEl;

    function render() {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Предложения с пропуском</label>
          <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Используйте ___ (три нижних подчёркивания) для обозначения пропуска</div>
          <div id="fb-list"></div>
          <button class="btn btn-ghost btn-sm" id="fb-add" style="margin-top:10px">+ Добавить предложение</button>
        </div>`;

      const list = container.querySelector('#fb-list');
      c.sentences.forEach((s, si) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:14px;margin-bottom:10px;position:relative';
        div.innerHTML = `
          <button class="item-delete" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
          <div class="form-group">
            <label class="form-label" style="font-size:12px">Предложение (используйте ___ для пропуска)</label>
            <input class="input-field fb-text" value="${escHtml(s.text||'')}" placeholder="Кошка сидит на ___">
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Правильный ответ</label>
              <input class="input-field fb-correct" value="${escHtml(s.correct||'')}" placeholder="диване">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Неверные варианты (через запятую)</label>
              <input class="input-field fb-opts" value="${escHtml((s.options||[]).join(', '))}" placeholder="столе, кровати">
            </div>
          </div>`;
        list.appendChild(div);
        div.querySelector('.fb-text').addEventListener('input', e => { c.sentences[si].text = e.target.value; });
        div.querySelector('.fb-correct').addEventListener('input', e => { c.sentences[si].correct = e.target.value; });
        div.querySelector('.fb-opts').addEventListener('input', e => {
          c.sentences[si].options = e.target.value.split(',').map(v=>v.trim()).filter(Boolean);
        });
        div.querySelector('.item-delete').addEventListener('click', () => { c.sentences.splice(si,1); render(); });
      });
      container.querySelector('#fb-add').addEventListener('click', () => {
        c.sentences.push({ text:'', correct:'', options:[] });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('fill_blank');
  },

  // ── Первый звук (first_sound) ───────────────────────────────────────────────
  // content: { items: [{word, image, letters:[{letter, correct}]}] }
  first_sound(editor) {
    const c = editor._content;
    if (!c.items) c.items = [];
    const container = editor._bodyEl;

    function render() {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Слова и буквы</label>
          <div id="fs-list"></div>
          <button class="btn btn-ghost btn-sm" id="fs-add" style="margin-top:10px">+ Добавить слово</button>
        </div>`;

      const list = container.querySelector('#fs-list');
      c.items.forEach((item, ii) => {
        if (!item.letters) item.letters = [];
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:14px;margin-bottom:10px;position:relative';
        div.innerHTML = `
          <button class="item-delete" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
          <div class="form-row form-row-2" style="margin-bottom:10px">
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Слово</label>
              <input class="input-field fs-word" value="${escHtml(item.word||item.label||'')}" placeholder="Яблоко">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Картинка</label>
              ${item.img||item.image ? `<img src="" data-path="${escHtml(item.img||item.image)}" class="lazy-img" style="height:50px;object-fit:contain;border-radius:6px;margin-bottom:4px;display:block">` : ''}
              <button class="btn btn-ghost btn-sm fs-img">🖼 ${item.img||item.image ? 'Сменить':'Выбрать'}</button>
            </div>
          </div>
          <label class="form-label" style="font-size:12px">Буквы-варианты (в поле — все буквы, отметьте правильную)</label>
          <div class="fs-letters" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"></div>
          <button class="btn btn-ghost btn-sm fs-add-letter">+ Буква</button>`;
        list.appendChild(div);
        loadLazyImages(div);

        div.querySelector('.fs-word').addEventListener('input', e => { c.items[ii].word = e.target.value; });
        div.querySelector('.fs-img').addEventListener('click', async () => {
          const p = await window.db.files.pickImage(); if (p) { c.items[ii].img = p; render(); }
        });
        div.querySelector('.item-delete').addEventListener('click', () => { c.items.splice(ii,1); render(); });

        const lettersWrap = div.querySelector('.fs-letters');
        item.letters.forEach((lt, li) => {
          const ld = document.createElement('div');
          ld.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--surface);border:2px solid '+(lt.correct?'var(--green)':'var(--border)')+';border-radius:var(--r-md);padding:8px 10px';
          ld.innerHTML = `
            <input class="input-field" value="${escHtml(lt.letter||'')}" style="width:46px;text-align:center;font-size:20px;font-weight:700;text-transform:uppercase;padding:4px">
            <label style="font-size:10px;cursor:pointer"><input type="radio" name="fs-correct-${ii}" ${lt.correct?'checked':''}> ✓</label>
            <button style="font-size:10px;color:var(--rose);background:none;border:none;cursor:pointer">✕</button>`;
          ld.querySelector('input[type=text]').addEventListener('input', e => { item.letters[li].letter = e.target.value.toUpperCase().charAt(0); });
          ld.querySelector('input[type=radio]').addEventListener('change', () => {
            item.letters.forEach((l,i) => l.correct = (i===li)); render();
          });
          ld.querySelector('button').addEventListener('click', () => { item.letters.splice(li,1); render(); });
          lettersWrap.appendChild(ld);
        });

        div.querySelector('.fs-add-letter').addEventListener('click', () => {
          item.letters.push({ letter:'', correct: item.letters.length===0 }); render();
        });
      });
      container.querySelector('#fs-add').addEventListener('click', () => {
        c.items.push({ word:'', img:'', letters:[{letter:'',correct:true},{letter:'',correct:false}] });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('first_sound');
  },

  // ── Сравни (compare) ────────────────────────────────────────────────────────
  // content: { tasks: [{left, right, answer:'>'|'<'|'=', question}] }
  compare(editor) {
    const c = editor._content;
    if (!c.tasks) c.tasks = [];
    const container = editor._bodyEl;

    function render() {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Задания на сравнение</label>
          <div id="cmp-list"></div>
          <button class="btn btn-ghost btn-sm" id="cmp-add" style="margin-top:10px">+ Добавить задание</button>
        </div>`;

      const list = container.querySelector('#cmp-list');
      c.tasks.forEach((task, ti) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:14px;margin-bottom:10px;position:relative';
        div.innerHTML = `
          <button class="item-delete" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
          <div class="form-group">
            <label class="form-label" style="font-size:12px">Вопрос (необязательно)</label>
            <input class="input-field cmp-q" value="${escHtml(task.question||'')}" placeholder="Что больше?">
          </div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:80px">
              <label class="form-label" style="font-size:12px">Левое</label>
              <input class="input-field cmp-left" value="${escHtml(task.left||'')}" placeholder="5" style="font-size:22px;font-weight:700;text-align:center">
            </div>
            <div class="form-group" style="min-width:100px">
              <label class="form-label" style="font-size:12px">Знак (ответ)</label>
              <select class="input-field select-field cmp-ans">
                <option value=">" ${task.answer==='>'?'selected':''}>&#62; (больше)</option>
                <option value="<" ${task.answer==='<'?'selected':''}>&#60; (меньше)</option>
                <option value="=" ${task.answer==='='?'selected':''}>= (равно)</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;min-width:80px">
              <label class="form-label" style="font-size:12px">Правое</label>
              <input class="input-field cmp-right" value="${escHtml(task.right||'')}" placeholder="3" style="font-size:22px;font-weight:700;text-align:center">
            </div>
          </div>`;
        list.appendChild(div);
        div.querySelector('.cmp-q').addEventListener('input', e => { c.tasks[ti].question = e.target.value; });
        div.querySelector('.cmp-left').addEventListener('input', e => { c.tasks[ti].left = e.target.value; });
        div.querySelector('.cmp-right').addEventListener('input', e => { c.tasks[ti].right = e.target.value; });
        div.querySelector('.cmp-ans').addEventListener('change', e => { c.tasks[ti].answer = e.target.value; });
        div.querySelector('.item-delete').addEventListener('click', () => { c.tasks.splice(ti,1); render(); });
      });
      container.querySelector('#cmp-add').addEventListener('click', () => {
        c.tasks.push({ left:'', right:'', answer:'>', question:'' }); render();
      });
    }
    render();
    EditorTypes._sidebarHint('compare');
  },

  // ── Назови эмоцию (emotion_match) ──────────────────────────────────────────
  // content: { tasks: [{image, situation, emotions:[{label, correct}]}] }
  emotion_match(editor) {
    const c = editor._content;
    if (!c.tasks) c.tasks = [];
    const container = editor._bodyEl;

    function render() {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Задания на эмоции</label>
          <div id="em-list"></div>
          <button class="btn btn-ghost btn-sm" id="em-add" style="margin-top:10px">+ Добавить задание</button>
        </div>`;

      const list = container.querySelector('#em-list');
      c.tasks.forEach((task, ti) => {
        if (!task.emotions) task.emotions = [];
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);padding:14px;margin-bottom:12px;position:relative';
        div.innerHTML = `
          <button class="item-delete" style="opacity:1;position:absolute;top:10px;right:10px">✕</button>
          <div class="form-row form-row-2" style="margin-bottom:10px">
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Картинка персонажа</label>
              ${task.image ? `<img src="" data-path="${escHtml(task.image)}" class="lazy-img" style="height:70px;object-fit:contain;border-radius:var(--r-md);margin-bottom:6px;display:block">` : ''}
              <button class="btn btn-ghost btn-sm em-img">🖼 ${task.image ? 'Сменить':'Выбрать'}</button>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Ситуация (необязательно)</label>
              <textarea class="input-field em-sit" rows="3" placeholder="Кот потерял мячик...">${escHtml(task.situation||'')}</textarea>
            </div>
          </div>
          <label class="form-label" style="font-size:12px">Варианты эмоций (отметьте правильную)</label>
          <div class="em-emos" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"></div>
          <button class="btn btn-ghost btn-sm em-add-emo">+ Эмоция</button>`;
        list.appendChild(div);
        loadLazyImages(div);

        div.querySelector('.em-img').addEventListener('click', async () => {
          const p = await window.db.files.pickImage(); if (p) { c.tasks[ti].image = p; render(); }
        });
        div.querySelector('.em-sit').addEventListener('input', e => { c.tasks[ti].situation = e.target.value; });
        div.querySelector('.item-delete').addEventListener('click', () => { c.tasks.splice(ti,1); render(); });

        const emosWrap = div.querySelector('.em-emos');
        task.emotions.forEach((emo, ei) => {
          const ed = document.createElement('div');
          ed.style.cssText = 'background:var(--surface);border:2px solid '+(emo.correct?'var(--green)':'var(--border)')+';border-radius:var(--r-md);padding:8px 12px;display:flex;flex-direction:column;align-items:center;gap:4px';
          ed.innerHTML = `
            <input class="input-field" value="${escHtml(emo.label||'')}" placeholder="Радость" style="width:110px;font-size:14px;text-align:center;padding:6px">
            <label style="font-size:11px;cursor:pointer"><input type="radio" name="em-correct-${ti}" ${emo.correct?'checked':''}> ✓ Верная</label>
            <button style="font-size:10px;color:var(--rose);background:none;border:none;cursor:pointer">✕</button>`;
          ed.querySelector('input[type=text]').addEventListener('input', e => { task.emotions[ei].label = e.target.value; });
          ed.querySelector('input[type=radio]').addEventListener('change', () => {
            task.emotions.forEach((e,i) => e.correct = (i===ei)); render();
          });
          ed.querySelector('button').addEventListener('click', () => { task.emotions.splice(ei,1); render(); });
          emosWrap.appendChild(ed);
        });

        div.querySelector('.em-add-emo').addEventListener('click', () => {
          task.emotions.push({ label:'', correct: task.emotions.length===0 }); render();
        });
      });
      container.querySelector('#em-add').addEventListener('click', () => {
        c.tasks.push({ image:'', situation:'', emotions:[{label:'',correct:true},{label:'',correct:false}] });
        render();
      });
    }
    render();
    EditorTypes._sidebarHint('emotion_match');
  },
});

// ── ЕДИНЫЙ роутер редактора — все 18 типов ────────────────────────────────────
(function unifyEditorRouter() {
  Editor._renderByType = function() {
    const type = this._exercise.type;
    const all = {
      // Первые 4 типа — встроены в базовый Editor._renderByType (используем их)
      sequencing:    () => EditorTypes.sequencing(this),
      memory:        () => EditorTypes.memory(this),
      whats_missing: () => EditorTypes.whats_missing(this),
      counting:      () => EditorTypes.counting(this),
      categories:    () => EditorTypes.categories(this),
      true_false:    () => EditorTypes.true_false(this),
      word_builder:  () => EditorTypes.word_builder(this),
      size_order:    () => EditorTypes.size_order(this),
      pattern:       () => EditorTypes.pattern(this),
      story_order:   () => EditorTypes.story_order(this),
      word_to_pic:   () => EditorTypes.word_to_pic(this),
      fill_blank:    () => EditorTypes.fill_blank(this),
      first_sound:   () => EditorTypes.first_sound(this),
      compare:       () => EditorTypes.compare(this),
      emotion_match: () => EditorTypes.emotion_match(this),
    };
    // Add the 4 base types to the map as well
    const base = {
      visual_match: () => EditorTypes.visualMatch(this),
      find_pairs:   () => EditorTypes.findPairs(this),
      memory_game:  () => EditorTypes.memory_game(this),
      odd_one_out:  () => EditorTypes.oddOneOut(this),
      sorting:      () => EditorTypes.sorting(this),
    };
    const fn = all[type] || base[type];
    if (fn) { fn(); }
    else {
      const { label } = exerciseTypeMeta(type);
      document.getElementById('editor-main').innerHTML = `<div class="empty-state"><div class="empty-title">Редактор для типа «${escHtml(label)}» в разработке</div></div>`;
    }
  };
})();

// ── Добавляем подсказки для новых типов ───────────────────────────────────────
Object.assign(EditorTypes._hints || {}, {
  pattern:       ['Продолжи ряд', 'Введите последовательность и варианты ответа. Укажите индекс правильного варианта (0 = первый).'],
  story_order:   ['История по порядку', 'Добавьте кадры в правильном порядке. Ученик будет их перемешивать и расставлять.'],
  word_to_pic:   ['Слово → картинка', 'Ученик видит слово и выбирает нужную картинку из нескольких вариантов.'],
  fill_blank:    ['Вставь слово', 'Используйте ___ (три подчёркивания) для обозначения пропуска в предложении.'],
  first_sound:   ['Первый звук', 'Ученик видит картинку или слово и определяет, с какой буквы оно начинается.'],
  compare:       ['Сравни', 'Введите два числа или величины. Ученик выбирает знак >, < или =.'],
  emotion_match: ['Назови эмоцию', 'Добавьте картинку и варианты эмоций. Отметьте правильную.'],
});
