// ── Палитра аватаров ────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#5B5BD6','#1A9E6A','#C27803','#D14343',
  '#0D9488','#7C3AED','#DB2777','#0284C7',
];

function avatarColor(id) {
  return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
}

function initials(firstName, lastName) {
  const f = (firstName || '').trim()[0] || '';
  const l = (lastName  || '').trim()[0] || '';
  return (f + l).toUpperCase() || '?';
}

// ── Форматирование ───────────────────────────────────────────────────────────
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtScore(correct, total) {
  if (!total) return '—';
  const pct = Math.round(correct / total * 100);
  return `${pct}%`;
}

function scoreClass(correct, total) {
  if (!total) return '';
  const p = correct / total;
  if (p >= 0.8) return 'score-high';
  if (p >= 0.5) return 'score-mid';
  return 'score-low';
}

// ── Сложность ────────────────────────────────────────────────────────────────
const DIFFICULTY_LABELS = { easy: 'Лёгкое', medium: 'Среднее', hard: 'Сложное' };

function difficultyTag(d) {
  const label = DIFFICULTY_LABELS[d] || d;
  return `<span class="tag difficulty-${d}">${label}</span>`;
}

// ── Типы упражнений ──────────────────────────────────────────────────────────

const TYPE_ICONS = {
  visual_match: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h5l3.5 5h9.5" /> <path d="M3 17h5l3.495 -5" /> <path d="M18 15l3 -3l-3 -3" /></svg>`,
  memory_game: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.604 7.197l7.138 -3.109a.96 .96 0 0 1 1.27 .527l4.924 11.902a1 1 0 0 1 -.514 1.304l-7.137 3.109a.96 .96 0 0 1 -1.271 -.527l-4.924 -11.903a1 1 0 0 1 .514 -1.304l0 .001" /> <path d="M15 4h1a1 1 0 0 1 1 1v3.5" /> <path d="M20 6c.264 .112 .52 .217 .768 .315a1 1 0 0 1 .53 1.311l-2.298 5.374" /></svg>`,
  find_pairs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /> <path d="M4 16v2a2 2 0 0 0 2 2h2" /> <path d="M16 4h2a2 2 0 0 1 2 2v2" /> <path d="M16 20h2a2 2 0 0 0 2 -2v-2" /> <path d="M8 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /> <path d="M16 16l-2.5 -2.5" /></svg>`,
  odd_one_out: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M10 10l4 4m0 -4l-4 4" /></svg>`,
  whats_missing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /> <path d="M14.071 17.764a8.989 8.989 0 0 1 -2.071 .236c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.346 0 6.173 1.727 8.482 5.182" /> <path d="M19 22v.01" /> <path d="M19 19a2.003 2.003 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483" /></svg>`,
  sorting: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /> <path d="M17 16v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2h2" /></svg>`,
  categories: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6h-6l0 -6" /> <path d="M14 4h6v6h-6l0 -6" /> <path d="M4 14h6v6h-6l0 -6" /> <path d="M14 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /></svg>`,
  sequencing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 5h-5v5h-5v5h-5v5h-5" /></svg>`,
  pattern: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l6 -7l5 5l5 -6" /> <path d="M14 14a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M9 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M3 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M19 8a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>`,
  word_to_pic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8h.01" /> <path d="M11.5 21h-5.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" /> <path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /> <path d="M20.2 20.2l1.8 1.8" /> <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l2 2" /></svg>`,
  word_builder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 15.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" /> <path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5" /> <path d="M3 13h7" /> <path d="M21 12v7" /></svg>`,
  fill_blank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h4" /> <path d="M9 4a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3" /> <path d="M15 4a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3" /></svg>`,
  first_sound: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a3 3 0 0 1 0 6" /> <path d="M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5" /> <path d="M12 8l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8" /></svg>`,
  counting: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18" /> <path d="M19 21v-18" /> <path d="M5 7h14" /> <path d="M5 15h14" /> <path d="M8 13v4" /> <path d="M11 13v4" /> <path d="M16 13v4" /> <path d="M14 5v4" /> <path d="M11 5v4" /> <path d="M8 5v4" /> <path d="M3 21h18" /></svg>`,
  size_order: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-7a1 1 0 0 0 -1 1v7a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1" /> <path d="M4 8l2 0" /> <path d="M4 12l3 0" /> <path d="M4 16l2 0" /> <path d="M8 4l0 2" /> <path d="M12 4l0 3" /> <path d="M16 4l0 2" /></svg>`,
  compare: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20l10 0" /> <path d="M6 6l6 -1l6 1" /> <path d="M12 3l0 17" /> <path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0" /> <path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0" /></svg>`,
  true_false: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12l5 5l10 -10" /> <path d="M2 12l5 5m5 -5l5 -5" /></svg>`,
  syllables: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12v-5.5a2.5 2.5 0 0 1 5 0v5.5m0 -4h-5" /> <path d="M13 4l3 8l3 -8" /> <path d="M5 18h14" /> <path d="M17 20l2 -2l-2 -2" /> <path d="M7 16l-2 2l2 2" /></svg>`,
  sound_position: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /> <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg>`,
  syllable_count: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5" /> <path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5" /> <path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5" /> <path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" /> <path d="M5 3l-1 -1" /> <path d="M4 7h-1" /> <path d="M14 3l1 -1" /> <path d="M15 6h1" /></svg>`,
  label_image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3" /></svg>`,
  yes_no: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" /></svg>`,
};

const EXERCISE_TYPES = [
  // ── Восприятие и внимание ─────────────────────────────────
  { key: 'visual_match',  label: 'Сопоставление',       group: 'perception', color: '#5B5BD6', colorL: '#EDEDFC',
    desc: 'Соедини картинку с картинкой, слово с картинкой или слово со словом' },
  { key: 'memory_game',   label: 'Мемо',                 group: 'perception', color: '#0D9488', colorL: '#CCFBF1',
    desc: 'Игра «Мемо» — перевернуть карточки и найти одинаковые пары' },
  { key: 'find_pairs',    label: 'Найди пару',           group: 'perception', color: '#0369A1', colorL: '#DBEAFE',
    desc: 'Соединить объекты из левого столбца с парами из правого' },
  { key: 'odd_one_out',   label: 'Лишний предмет',       group: 'perception', color: '#D14343', colorL: '#FDEDED',
    desc: 'Из 4 предметов найти тот, который не подходит к остальным' },
  { key: 'whats_missing', label: 'Что исчезло?',         group: 'perception', color: '#0284C7', colorL: '#E0F2FE',
    desc: 'Запомнить набор предметов, потом найти что убрали' },
  { key: 'label_image',   label: 'Подпиши картинку',     group: 'perception', color: '#0369A1', colorL: '#DBEAFE',
    desc: 'Выбрать подписи к отмеченным частям изображения' },
  // ── Мышление и логика ────────────────────────────────────
  { key: 'sorting',       label: 'Сортировка',           group: 'thinking', color: '#1A9E6A', colorL: '#E3F5ED',
    desc: 'Распределить предметы по двум категориям' },
  { key: 'categories',    label: 'Три группы',           group: 'thinking', color: '#EA580C', colorL: '#FFF7ED',
    desc: 'Распределить предметы по трём и более категориям' },
  { key: 'sequencing',    label: 'Последовательность',   group: 'thinking', color: '#C27803', colorL: '#FEF3CD',
    desc: 'Расположить события, числа или картинки в правильном порядке' },
  { key: 'pattern',       label: 'Продолжи ряд',         group: 'thinking', color: '#0891B2', colorL: '#ECFEFF',
    desc: 'Найти закономерность и выбрать следующий элемент' },
  { key: 'true_false',    label: 'Верно / Неверно',      group: 'thinking', color: '#0891B2', colorL: '#F0FDFA',
    desc: 'Картинка и утверждение — решить, правда это или нет' },
  { key: 'yes_no',        label: 'Да / Нет',             group: 'thinking', color: '#1A9E6A', colorL: '#E3F5ED',
    desc: 'Быстро сортировать карточки на две стопки по заданному признаку' },
  // ── Грамота и речь ───────────────────────────────────────
  { key: 'word_to_pic',   label: 'Слово → картинка',     group: 'literacy', color: '#BE185D', colorL: '#FCE7F3',
    desc: 'Прочитать слово и выбрать соответствующую картинку' },
  { key: 'word_builder',  label: 'Составь слово',        group: 'literacy', color: '#DB2777', colorL: '#FDF2F8',
    desc: 'Собрать слово из перемешанных букв' },
  { key: 'fill_blank',    label: 'Вставь слово',         group: 'literacy', color: '#6D28D9', colorL: '#F5F3FF',
    desc: 'Выбрать подходящее слово для заполнения пропуска в предложении' },
  { key: 'first_sound',   label: 'Первый звук',          group: 'literacy', color: '#0369A1', colorL: '#E0F2FE',
    desc: 'Определить первый звук или букву слова по картинке' },
  { key: 'syllables',     label: 'Слоги → слово',        group: 'literacy', color: '#7C3AED', colorL: '#F3E8FF',
    desc: 'Собрать слово из перемешанных слогов, нажимая по очереди' },
  { key: 'sound_position',label: 'Место звука',          group: 'literacy', color: '#0D9488', colorL: '#CCFBF1',
    desc: 'Определить, где стоит заданный звук: в начале, середине или конце слова' },
  { key: 'syllable_count',label: 'Считай слоги',         group: 'literacy', color: '#EA580C', colorL: '#FFF7ED',
    desc: 'Посчитать слоги в слове: нажать кнопку нужное количество раз' },
  // ── Математика ───────────────────────────────────────────
  { key: 'counting',      label: 'Считаем',              group: 'math', color: '#65A30D', colorL: '#ECFCCB',
    desc: 'Посчитать предметы на картинке и выбрать правильное число' },
  { key: 'size_order',    label: 'По размеру',           group: 'math', color: '#9333EA', colorL: '#F5F3FF',
    desc: 'Упорядочить предметы от меньшего к большему или наоборот' },
  { key: 'compare',       label: 'Сравни',               group: 'math', color: '#047857', colorL: '#ECFDF5',
    desc: 'Сравнить два множества или размера: больше, меньше или равно' },
];

function exerciseTypeMeta(key) {
  return EXERCISE_TYPES.find(t => t.key === key) || { label: key, color: '#9C9C94', colorL: '#F3F3F0' };
}

function typeIcon(key, size=20) {
  const svg = TYPE_ICONS[key];
  if (!svg) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>`;
  return svg.replace('viewBox="0 0 24 24"', `width="${size}" height="${size}" viewBox="0 0 24 24"`);
}

function typeBadge(key) {
  const m = exerciseTypeMeta(key);
  return `<span class="exercise-type-badge" style="background:${m.colorL};color:${m.color};display:inline-flex;align-items:center;gap:5px">
    <span style="width:14px;height:14px;flex-shrink:0;display:inline-flex">${typeIcon(key,14)}</span>${m.label}</span>`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const Modal = {
  open(titleText, bodyHTML, footerHTML = '') {
    document.getElementById('modal-content').innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${titleText}</span>
        <button class="modal-close" onclick="Modal.close()">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },
  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-content').innerHTML = '';
  },
  confirm(title, text, onConfirm, confirmLabel = 'Подтвердить', isDanger = false) {
    Modal.open(title,
      `<p style="color:var(--text-2);line-height:1.6">${text}</p>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Отмена</button>
       <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmLabel}</button>`
    );
    document.getElementById('modal-confirm-btn').onclick = () => { Modal.close(); onConfirm(); };
  },
};

// Закрыть по клику на оверлей
document.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') Modal.close();
});

// ── Мелкие хелперы ───────────────────────────────────────────────────────────
function plural(n, one, few, many) {
  const m  = Math.abs(n) % 100;
  const m1 = m % 10;
  if (m >= 11 && m <= 19) return many;
  if (m1 === 1) return one;
  if (m1 >= 2 && m1 <= 4) return few;
  return many;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.append(typeof c === 'string' ? c : c));
  return node;
}

// Иконка SVG (inline, чтобы не зависеть от внешних файлов)
const Icons = {
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  plus:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  trash:  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M6 6.5v4M8 6.5v4M3.5 3.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  pencil: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2l7.5-7.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  play:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2.5l7 4.5-7 4.5V2.5z" fill="currentColor"/></svg>`,
  back:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// Expose to global scope for inline onclick handlers
window.Modal = Modal;

// Global helpers used in inline handlers
window.openAddStudentModal = function(s) { openAddStudentModal(s); };
window.closeStudentDrawer = function() { closeStudentDrawer(); };
window.openExerciseModal = function(ex) { openExerciseModal(ex); };
window.uploadDiagnostic = function() { uploadDiagnostic(); };
window.openDiagModal = function() { openDiagModal(); };
