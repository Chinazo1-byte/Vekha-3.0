// ══════════════════════════════════════════════════════════════════════════════
//  HTML-ШАБЛОН ОТЧЁТА
//  Генерирует HTML-строку, которую Electron конвертирует в PDF
// ══════════════════════════════════════════════════════════════════════════════

function buildReportHTML(data) {
  const { student, diag_results = [], ex_results = [] } = data;
  const name = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'Ученик';
  const today = new Date().toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });

  const birthDate = student.birth_date
    ? new Date(student.birth_date).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' })
    : null;

  const age = student.birth_date ? calcAge(student.birth_date) : null;

  // ── Хелперы ─────────────────────────────────────────────────────────────
  function calcAge(bd) {
    const d = new Date(bd), n = new Date();
    let y = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) y--;
    return y;
  }
  function fmtDate(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }); }
    catch(e) { return String(s).slice(0,10); }
  }
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function levelInfo(level) {
    return {
      norm:      { label:'Норма',    color:'#059669', bg:'#ECFDF5', border:'#6EE7B7' },
      attention: { label:'Внимание', color:'#D97706', bg:'#FFFBEB', border:'#FCD34D' },
      risk:      { label:'Риск',     color:'#E11D48', bg:'#FFF1F2', border:'#FECDD3' },
    }[level] || { label:'—', color:'#9CA3AF', bg:'#F9FAFB', border:'#E5E7EB' };
  }
  function scoreColor(pct) {
    if (pct === null || pct === undefined) return '#9CA3AF';
    if (pct >= 80) return '#059669';
    if (pct >= 50) return '#D97706';
    return '#E11D48';
  }
  function miniBarsSVG(values, maxVal = 100) {
    if (!values.length) return '';
    const W = 400, H = 60, pad = 4;
    const bw = Math.floor((W - pad * (values.length + 1)) / values.length);
    const bars = values.map((v, i) => {
      const h   = Math.max(3, Math.round(v / maxVal * H));
      const x   = pad + i * (bw + pad);
      const y   = H - h;
      const col = v >= 80 ? '#059669' : v >= 50 ? '#D97706' : '#E11D48';
      return `
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${col}" opacity=".8"/>
        <text x="${x + bw/2}" y="${H + 12}" font-size="9" fill="#9CA3AF" text-anchor="middle">${Math.round(v)}%</text>
        <text x="${x + bw/2}" y="${H + 22}" font-size="8" fill="#D1D5DB" text-anchor="middle">${i+1}</text>`;
    }).join('');
    return `<svg width="${W}" height="${H + 28}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
  }
  function luriaCurve(attempts) {
    if (!attempts?.length) return '';
    const W = 340, H = 60, pad = 6;
    const n   = attempts.length;
    const bw  = Math.floor((W - pad * (n + 1)) / n);
    const bars = attempts.map((v, i) => {
      const h     = Math.max(3, Math.round(v / 10 * H));
      const x     = pad + i * (bw + pad);
      const y     = H - h;
      const col   = i < 5 ? '#4F46E5' : '#D97706';
      const lbl   = i < 5 ? String(i + 1) : 'Отср';
      return `
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="2" fill="${col}" opacity=".85"/>
        <text x="${x+bw/2}" y="${H+11}" font-size="9" fill="#374151" text-anchor="middle">${v}</text>
        <text x="${x+bw/2}" y="${H+21}" font-size="8" fill="#9CA3AF" text-anchor="middle">${lbl}</text>`;
    }).join('');
    return `<svg width="${W}" height="${H+26}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
  }
  function luscherRowSVG(avgPos) {
    if (!avgPos) return '';
    const COLORS = [
      {id:0,hex:'#808080',name:'Серый'},{id:1,hex:'#3B5FBB',name:'Синий'},
      {id:2,hex:'#3A8B3D',name:'Зелён.'},{id:3,hex:'#D12B2B',name:'Красн.'},
      {id:4,hex:'#F5C800',name:'Жёлтый'},{id:5,hex:'#8B4AC8',name:'Фиол.'},
      {id:6,hex:'#7B4B2A',name:'Корич.'},{id:7,hex:'#1A1A1A',name:'Чёрный'},
    ];
    const sorted = COLORS.slice().sort((a,b) => (avgPos[a.id]||9) - (avgPos[b.id]||9));
    const rects  = sorted.map((c,i) => {
      const x = 4 + i * 44;
      return `
        <rect x="${x}" y="4" width="38" height="38" rx="6" fill="${c.hex}" stroke="${c.hex==='#F5C800'?'#D97706':'none'}" stroke-width="1"/>
        <text x="${x+19}" y="52" font-size="8.5" fill="#6B7280" text-anchor="middle">${c.name}</text>
        <text x="${x+19}" y="62" font-size="9" font-weight="bold" fill="#374151" text-anchor="middle">${i+1}</text>`;
    }).join('');
    return `<svg width="360" height="68" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  // ── Блок диагностики ────────────────────────────────────────────────────
  function diagBlock(r) {
    const li    = levelInfo(r.level);
    const dname = esc(r.name || r.method_name || 'Диагностика');
    const date  = fmtDate(r.completed_at);
    const markers = (r.markers || []).map(m => `<li>${esc(m)}</li>`).join('');
    const risks   = (r.risks   || []).map(m => `<li class="risk-item">${esc(m)}</li>`).join('');

    // Специальные визуализации
    let extra = '';
    try {
      const scores = typeof r.raw_scores === 'object' ? r.raw_scores : {};
      if (r.method_id === 'luscher' && scores.avgPos) {
        extra = `<div class="chart-wrap">${luscherRowSVG(scores.avgPos)}</div>`;
      }
      if (r.method_id === 'luria10' && scores.immediate) {
        extra = `<div class="chart-wrap">${luriaCurve([...scores.immediate, ...(scores.delayed != null ? [scores.delayed] : [])])}</div>`;
      }
    } catch(e) {}

    return `
      <div class="diag-block">
        <div class="diag-header" style="background:${li.bg};border-left:4px solid ${li.color}">
          <div>
            <div class="diag-name">${dname}</div>
            <div class="diag-date">Дата: ${date}</div>
          </div>
          <div class="level-badge" style="background:${li.color}">${li.label}</div>
        </div>
        ${r.summary ? `<div class="diag-summary">${esc(r.summary)}</div>` : ''}
        ${extra}
        ${markers ? `<ul class="marker-list">${markers}</ul>` : ''}
        ${risks   ? `<ul class="risk-list">${risks}</ul>` : ''}
      </div>`;
  }

  // ── Сводная таблица ─────────────────────────────────────────────────────
  function summaryTable() {
    const allRows = [
      ...diag_results.map(r => {
        const li = levelInfo(r.level);
        return `<tr>
          <td>${esc(r.name || r.method_name || '—')}</td>
          <td>${fmtDate(r.completed_at)}</td>
          <td>${esc(r.summary || '—')}</td>
          <td><span class="badge" style="background:${li.bg};color:${li.color};border:1px solid ${li.border}">${li.label}</span></td>
        </tr>`;
      }),
      ...ex_results.map(r => {
        const pct = r.total > 0 ? Math.round(r.correct / r.total * 100) : null;
        const col = scoreColor(pct);
        const pctStr = pct !== null ? `${pct}%` : '—';
        return `<tr>
          <td>${esc(r.exercise_name || '—')}</td>
          <td>${fmtDate(r.completed_at)}</td>
          <td>${r.total > 0 ? `${r.correct}/${r.total} правильно` : '—'}</td>
          <td><span class="badge" style="background:${col}22;color:${col};border:1px solid ${col}44">${pctStr}</span></td>
        </tr>`;
      }),
    ];
    if (!allRows.length) return '';
    return `
      <table class="summary-table">
        <thead><tr><th>Методика / упражнение</th><th>Дата</th><th>Результат</th><th>Оценка</th></tr></thead>
        <tbody>${allRows.join('')}</tbody>
      </table>`;
  }

  // ── Таблица упражнений ──────────────────────────────────────────────────
  function exTable() {
    if (!ex_results.length) return '';
    const rows = ex_results.map(r => {
      const pct = r.total > 0 ? Math.round(r.correct / r.total * 100) : null;
      const col = scoreColor(pct);
      return `<tr>
        <td>${esc(r.exercise_name || '—')}</td>
        <td style="color:#6B7280">${esc(r.exercise_type || '—')}</td>
        <td><b style="color:${col}">${pct !== null ? pct+'%' : '—'}</b> <span style="color:#D1D5DB">(${r.correct||0}/${r.total||0})</span></td>
        <td style="color:#9CA3AF">${r.duration_sec ? r.duration_sec + ' с' : '—'}</td>
        <td style="color:#9CA3AF">${fmtDate(r.completed_at)}</td>
      </tr>`;
    }).join('');
    const withPct = ex_results.filter(r => r.total > 0);
    const chartVals = withPct.slice(0, 10).reverse().map(r => Math.round(r.correct / r.total * 100));
    return `
      <h2>Упражнения</h2>
      ${chartVals.length >= 2 ? `<p class="chart-label">Динамика результатов (%, последние ${chartVals.length} занятий):</p>
      <div class="chart-wrap">${miniBarsSVG(chartVals)}</div>` : ''}
      <table class="summary-table">
        <thead><tr><th>Упражнение</th><th>Тип</th><th>Результат</th><th>Время</th><th>Дата</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Рекомендации ────────────────────────────────────────────────────────
  function recommendations() {
    const risks = diag_results.filter(r => r.level === 'risk');
    if (!risks.length) return '';
    const names = risks.map(r => r.name || r.method_name || '').filter(Boolean).join(', ');
    return `
      <div class="rec-block">
        <div class="rec-title">⚡ Рекомендации</div>
        <p>По результатам диагностик (<b>${esc(names)}</b>) выявлены показатели, требующие дополнительного внимания.</p>
        <p>Рекомендуется консультация специалиста (нейропсихолог, логопед, детский психолог) и повторная диагностика через 3–4 недели.</p>
      </div>`;
  }

  // ── CSS ─────────────────────────────────────────────────────────────────
  const css = `
    @page { size: A4; margin: 20mm 22mm 24mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #111827; line-height: 1.55; }
    .page-header { border-bottom: 2.5px solid #4F46E5; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .student-name { font-size: 22pt; font-weight: 700; color: #4F46E5; line-height: 1.2; }
    .student-meta { font-size: 9.5pt; color: #6B7280; margin-top: 4px; }
    .report-date  { font-size: 8.5pt; color: #9CA3AF; text-align: right; }
    .notes-block  { background: #F9FAFB; border-radius: 6px; padding: 8px 12px; margin-top: 10px; font-size: 9pt; color: #374151; }

    h2 { font-size: 13pt; font-weight: 700; color: #111827; margin: 22px 0 10px; border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; }
    h3 { font-size: 10.5pt; font-weight: 700; color: #374151; margin: 14px 0 6px; }

    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9pt; }
    .summary-table th { background: #EEF2FF; color: #4F46E5; font-weight: 700; padding: 7px 8px; text-align: left; font-size: 8pt; }
    .summary-table td { padding: 6px 8px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
    .summary-table tr:nth-child(even) td { background: #F9FAFB; }
    .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 8.5pt; font-weight: 700; }

    .diag-block { margin-bottom: 16px; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
    .diag-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; }
    .diag-name { font-size: 11pt; font-weight: 700; color: #111827; }
    .diag-date { font-size: 8pt; color: #9CA3AF; margin-top: 2px; }
    .level-badge { color: #fff; padding: 3px 12px; border-radius: 20px; font-size: 8.5pt; font-weight: 700; }
    .diag-summary { padding: 8px 14px; font-size: 9pt; color: #374151; background: #FAFAFA; border-top: 1px solid #F3F4F6; }
    .marker-list { padding: 8px 14px 8px 28px; font-size: 9pt; color: #374151; }
    .marker-list li { margin-bottom: 3px; }
    .risk-list { padding: 6px 14px 8px 28px; font-size: 9pt; color: #BE123C; background: #FFF1F2; }
    .risk-list li { margin-bottom: 3px; }
    .risk-item { color: #BE123C !important; }
    .chart-wrap { padding: 8px 14px 4px; }
    .chart-label { font-size: 8.5pt; color: #9CA3AF; padding: 4px 14px 0; }

    .rec-block { background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 14px 16px; margin: 16px 0; }
    .rec-title { font-size: 11pt; font-weight: 700; color: #D97706; margin-bottom: 8px; }
    .rec-block p { font-size: 9.5pt; color: #374151; margin-bottom: 5px; line-height: 1.6; }

    .footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #E5E7EB; padding: 6px 22mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #9CA3AF; background: white; }
  `;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>${css}</style>
</head>
<body>

  <!-- Шапка -->
  <div class="page-header">
    <div>
      <div class="student-name">${esc(name)}</div>
      <div class="student-meta">${[birthDate ? `Дата рождения: ${birthDate}` : '', age ? `${age} лет` : ''].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="report-date">Дата отчёта:<br>${today}</div>
  </div>
  ${student.notes ? `<div class="notes-block"><b>Примечания:</b> ${esc(student.notes)}</div>` : ''}

  <!-- Сводка -->
  ${diag_results.length || ex_results.length ? `<h2>Сводка результатов</h2>${summaryTable()}` : ''}

  <!-- Диагностики -->
  ${diag_results.length ? `<h2>Результаты диагностик</h2>${diag_results.map(diagBlock).join('')}` : ''}

  <!-- Упражнения -->
  ${exTable()}

  <!-- Рекомендации -->
  ${recommendations()}

  <!-- Нижний колонтитул -->
  <div class="footer">
    <span>${esc(name)}</span>
    <span>Ясная Грань · ${today}</span>
  </div>

</body>
</html>`;
}

module.exports = { buildReportHTML };
