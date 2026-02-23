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
  visual_match:  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="5" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="15" cy="13" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M8 7h4M8 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 7l1.5 3L12 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  find_pairs:    `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="9" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 6h2M14.5 13h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  odd_one_out:   `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="6" cy="7" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="7" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="14" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="7" r="2.5" fill="currentColor" opacity=".15"/><path d="M13 13l3 3M16 13l-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  whats_missing: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="12" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="12" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.5"/><path d="M16 9l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sorting:       `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h6M3 10h6M3 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="12" y="3" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="12" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity=".2"/></svg>`,
  categories:    `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity=".15"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity=".3"/><path d="M13 14.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sequencing:    `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="7" width="4" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="5" width="4" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="3" width="4" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M5 10h2M11 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  pattern:       `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="10" r="2" fill="currentColor" opacity=".8"/><rect x="8" y="8" width="4" height="4" rx="0.5" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="10" r="2" fill="currentColor" opacity=".8"/><path d="M3 15l2-2M6 15l-1-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M15 5l1 1.5L17 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  story_order:   `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="5" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8.5" y="4" width="5" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity=".12"/><rect x="15" y="4" width="3" height="7" rx="1" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.5 1"/><path d="M4 14.5h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13 13l2 1.5L13 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  word_to_pic:   `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 7h8M3 10h6M3 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="12" y="6" width="6" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M12 11l2-2 2 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14.5" cy="8.5" r="1" fill="currentColor"/></svg>`,
  word_builder:  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="6" width="5" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="7.5" y="6" width="5" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="6" width="5" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M3 10h1.5M9.5 10H11M16 10h1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  fill_blank:    `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 7h5M3 11h3M11 7h6M10 11h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="7" y="9" width="3" height="3" rx="0.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.5 1"/><path d="M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".4"/></svg>`,
  first_sound:   `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h1M12 10h1M10 7v1M10 12v1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  counting:      `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="5" cy="6" r="1.5" fill="currentColor"/><circle cx="10" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="5" cy="11" r="1.5" fill="currentColor"/><circle cx="10" cy="11" r="1.5" fill="currentColor"/><path d="M13 14l1.5 1.5L18 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  size_order:    `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="14" width="3" height="4" rx="0.5" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="10" width="3" height="8" rx="0.5" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="6" width="3" height="12" rx="0.5" stroke="currentColor" stroke-width="1.5"/><path d="M17 4l1.5 3M17 4l-1.5 3M17 4v6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  compare:       `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="5" cy="10" r="3.5" stroke="currentColor" stroke-width="1.5"/><circle cx="15" cy="10" r="3.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity=".12"/><path d="M9 8.5l2 1.5-2 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  true_false:    `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l3 3 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/></svg>`,
  emotion_match: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M7 12.5c.8 1.2 2 1.8 3 1.8s2.2-.6 3-1.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7.5" cy="9" r="1" fill="currentColor"/><circle cx="12.5" cy="9" r="1" fill="currentColor"/></svg>`,
};

const EXERCISE_TYPES = [
  // ── Восприятие и сопоставление ───────────────────────────
  { key: 'visual_match',  label: 'Сопоставление',       color: '#5B5BD6', colorL: '#EDEDFC',
    desc: 'Соедини картинку с картинкой, слово с картинкой или слово со словом' },
  { key: 'find_pairs',    label: 'Найди пару',           color: '#0D9488', colorL: '#CCFBF1',
    desc: 'Игра «Мемо» — перевернуть карточки и найти одинаковые пары' },
  { key: 'odd_one_out',   label: 'Лишний предмет',       color: '#D14343', colorL: '#FDEDED',
    desc: 'Из 4 предметов найти тот, который не подходит к остальным' },
  // ── Память и внимание ────────────────────────────────────
  { key: 'whats_missing', label: 'Что исчезло?',         color: '#0284C7', colorL: '#E0F2FE',
    desc: 'Запомнить набор предметов, потом найти что убрали' },
  // ── Мышление и классификация ─────────────────────────────
  { key: 'sorting',       label: 'Сортировка',           color: '#1A9E6A', colorL: '#E3F5ED',
    desc: 'Распределить предметы по двум категориям' },
  { key: 'categories',    label: 'Три группы',           color: '#EA580C', colorL: '#FFF7ED',
    desc: 'Распределить предметы по трём и более категориям' },
  { key: 'sequencing',    label: 'Последовательность',   color: '#C27803', colorL: '#FEF3CD',
    desc: 'Расположить события, числа или картинки в правильном порядке' },
  { key: 'pattern',       label: 'Продолжи ряд',         color: '#0891B2', colorL: '#ECFEFF',
    desc: 'Найти закономерность и выбрать следующий элемент' },
  { key: 'story_order',   label: 'История по порядку',   color: '#B45309', colorL: '#FEF3C7',
    desc: 'Расставить кадры истории в правильном порядке' },
  // ── Речь и грамота ───────────────────────────────────────
  { key: 'word_to_pic',   label: 'Слово → картинка',     color: '#BE185D', colorL: '#FCE7F3',
    desc: 'Прочитать слово и выбрать соответствующую картинку' },
  { key: 'word_builder',  label: 'Составь слово',        color: '#DB2777', colorL: '#FDF2F8',
    desc: 'Собрать слово из перемешанных букв' },
  { key: 'fill_blank',    label: 'Вставь слово',         color: '#6D28D9', colorL: '#F5F3FF',
    desc: 'Выбрать подходящее слово для заполнения пропуска в предложении' },
  { key: 'first_sound',   label: 'Первый звук',          color: '#0369A1', colorL: '#E0F2FE',
    desc: 'Определить первый звук или букву слова по картинке' },
  // ── Математика и количество ──────────────────────────────
  { key: 'counting',      label: 'Считаем',              color: '#65A30D', colorL: '#ECFCCB',
    desc: 'Посчитать предметы на картинке и выбрать правильное число' },
  { key: 'size_order',    label: 'По размеру',           color: '#9333EA', colorL: '#F5F3FF',
    desc: 'Упорядочить предметы от меньшего к большему или наоборот' },
  { key: 'compare',       label: 'Сравни',               color: '#047857', colorL: '#ECFDF5',
    desc: 'Сравнить два множества или размера: больше, меньше или равно' },
  // ── Эмоции и социальное познание ─────────────────────────
  { key: 'true_false',    label: 'Верно / Неверно',      color: '#0891B2', colorL: '#F0FDFA',
    desc: 'Картинка и утверждение — решить, правда это или нет' },
  { key: 'emotion_match', label: 'Назови эмоцию',        color: '#F59E0B', colorL: '#FFFBEB',
    desc: 'Определить эмоцию персонажа и выбрать правильное название' },
];

function exerciseTypeMeta(key) {
  return EXERCISE_TYPES.find(t => t.key === key) || { label: key, color: '#9C9C94', colorL: '#F3F3F0' };
}

function typeIcon(key, size=20) {
  const svg = TYPE_ICONS[key];
  if (!svg) return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/></svg>`;
  return svg.replace(/width="20" height="20"/, `width="${size}" height="${size}"`);
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
