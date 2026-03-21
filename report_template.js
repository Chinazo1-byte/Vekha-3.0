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

  // ── SVG-хелперы для новых методик ───────────────────────────────────────
  function sanProfileSVG(scores) {
    const keys  = ['С','А','Н'];
    const names = {'С':'Самочувствие','А':'Активность','Н':'Настроение'};
    const norms = {'С':5.4,'А':5.0,'Н':5.1};
    const cols  = {'С':'#4F46E5','А':'#059669','Н':'#D97706'};
    const H=16, gap=8;
    let y=0, svg='';
    keys.forEach(k=>{
      const v   = scores[k]||0;
      const norm= norms[k];
      const pct = Math.round(v/7*100);
      const np  = Math.round(norm/7*100);
      const col = cols[k];
      svg += `<text x="0" y="${y+12}" font-size="9" fill="#374151" font-weight="600">${names[k]}</text>`;
      svg += `<rect x="120" y="${y+2}" width="220" height="${H}" rx="3" fill="#F3F4F6"/>`;
      svg += `<rect x="120" y="${y+2}" width="${Math.round(pct/100*220)}" height="${H}" rx="3" fill="${col}" opacity=".8"/>`;
      svg += `<line x1="${120+Math.round(np/100*220)}" y1="${y}" x2="${120+Math.round(np/100*220)}" y2="${y+H+6}" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="2,2"/>`;
      svg += `<text x="348" y="${y+12}" font-size="9" font-weight="700" fill="${col}" text-anchor="end">${v}</text>`;
      svg += `<text x="380" y="${y+12}" font-size="8" fill="#9CA3AF">/7</text>`;
      y += H+gap;
    });
    return `<svg width="400" height="${y}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  }

  function ostProfileSVG(scores) {
    const subs = [
      {id:'ER',name:'Предм. эргичность',max:12},{id:'SR',name:'Соц. эргичность',max:12},
      {id:'PL',name:'Пластичность',max:12},{id:'SP',name:'Соц. пластичность',max:12},
      {id:'T',name:'Темп',max:12},{id:'ST',name:'Социальный темп',max:12},
      {id:'EM',name:'Эмоциональность',max:12},{id:'SE',name:'Соц. эмоциональность',max:12},
    ];
    const COLS=['#4F46E5','#059669','#D97706','#0D9488','#7C3AED','#E11D48','#EA580C','#6B7280'];
    const H=13, gap=6;
    let y=0, svg='';
    subs.forEach((sub,i)=>{
      const v  = scores[sub.id]||0;
      const pct= v/sub.max;
      const col= COLS[i];
      const lbl= v>=9?'выс':v>=5?'ср':'низ';
      const lc = v>=9?'#059669':v>=5?'#D97706':'#E11D48';
      svg += `<text x="0" y="${y+10}" font-size="8" fill="#374151">${sub.name}</text>`;
      svg += `<rect x="120" y="${y+1}" width="220" height="${H}" rx="2" fill="#F3F4F6"/>`;
      svg += `<line x1="${120+Math.round(4/12*220)}" y1="${y}" x2="${120+Math.round(4/12*220)}" y2="${y+H+4}" stroke="#E5E7EB" stroke-width="1"/>`;
      svg += `<line x1="${120+Math.round(8/12*220)}" y1="${y}" x2="${120+Math.round(8/12*220)}" y2="${y+H+4}" stroke="#E5E7EB" stroke-width="1"/>`;
      svg += `<rect x="120" y="${y+1}" width="${Math.round(pct*220)}" height="${H}" rx="2" fill="${col}" opacity=".75"/>`;
      svg += `<text x="348" y="${y+10}" font-size="8" font-weight="700" fill="${col}" text-anchor="end">${v}</text>`;
      svg += `<text x="385" y="${y+10}" font-size="8" fill="${lc}" font-weight="700">${lbl}</text>`;
      y += H+gap;
    });
    return `<svg width="400" height="${y}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  }

  function rokichTopHTML(list, actual, ideal, deltas, title) {
    if (!actual||!actual.length||!ideal||!ideal.length) return '';
    const rA={}, rI={};
    actual.forEach((id,i)=>rA[id]=i+1);
    ideal.forEach((id,i)=>rI[id]=i+1);
    const top5 = ideal.slice(0,5);
    const rows = top5.map(id=>{
      const item = list.find(x=>x.id===id);
      const d = deltas[id]||0;
      const col = d>=7?'#E11D48':d>=4?'#D97706':'#374151';
      return `<tr>
        <td style="padding:3px 7px;font-size:8.5pt">${esc(item?item.t:id)}</td>
        <td style="padding:3px 7px;text-align:center;font-size:8.5pt;font-weight:700;color:#4F46E5">${rI[id]||'—'}</td>
        <td style="padding:3px 7px;text-align:center;font-size:8.5pt;color:#6B7280">${rA[id]||'—'}</td>
        <td style="padding:3px 7px;text-align:center;font-size:8.5pt;font-weight:700;color:${col}">${d>0?'±'+d:'0'}</td>
      </tr>`;
    }).join('');
    return `<div style="margin-bottom:8px">
      <div style="font-size:8pt;font-weight:700;color:#6B7280;margin-bottom:4px">${esc(title)} — топ-5</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB">
        <thead style="background:#EEF2FF"><tr>
          <th style="padding:4px 7px;text-align:left;font-size:8pt;color:#4F46E5">Ценность</th>
          <th style="padding:4px 7px;text-align:center;font-size:8pt;color:#4F46E5">Идеал</th>
          <th style="padding:4px 7px;text-align:center;font-size:8pt;color:#4F46E5">Реально</th>
          <th style="padding:4px 7px;text-align:center;font-size:8pt;color:#4F46E5">Δ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }


  // ── Рендер пользовательского v2 опросника (с ответами + интерпретацией) ──
  function v2CustomBlock(data, answers, scores) {
    if (!data || !answers) return '';
    const elems = data.elements || [];
    const interp = data.interpretation;
    let html = '';

    // Интерпретация (если задана)
    if (interp && interp.ranges && interp.ranges.length) {
      const total = scores && scores.total != null ? scores.total : 0;
      const rng   = interp.ranges.find(r => total >= r.from && total <= r.to);
      const li2   = rng ? levelInfo(rng.level||'norm') : levelInfo('norm');
      html += `<div style="padding:8px 14px;background:${li2.bg};border-top:1px solid ${li2.border}">
        <div style="font-size:8pt;font-weight:700;color:${li2.color};margin-bottom:2px">
          Сумма баллов: ${total}
          ${rng ? ` — ${esc(rng.label.split('\n')[0])}` : ''}
        </div>
        ${rng && rng.desc ? `<div style="font-size:8.5pt;color:#374151;line-height:1.5;margin-top:3px">${esc(rng.desc)}</div>` : ''}
      </div>`;
    }

    // Подшкалы (если есть)
    const subScores = scores && scores.subscaleScores ? scores.subscaleScores : {};
    const subDefs   = data.subscales || [];
    if (subDefs.length && Object.keys(subScores).length) {
      const subRows = subDefs.map(sub => {
        const val = subScores[sub.name] != null ? subScores[sub.name] : subScores[sub.id];
        if (val == null) return '';
        const subRngs   = interp && interp.subscaleRanges ? (interp.subscaleRanges[sub.name] || interp.subscaleRanges[sub.id] || []) : [];
        const subRange  = subRngs.length ? subRngs.find(r => val >= r.from && val <= r.to) : null;
        const slc       = subRange ? levelInfo(subRange.level||'norm') : { color:'#4F46E5', bg:'#EEF2FF', border:'#C7D2FE' };
        return `<tr>
          <td style="padding:4px 8px;font-size:8.5pt">${esc(sub.name||sub.id)}</td>
          <td style="padding:4px 8px;font-size:8.5pt;font-weight:700;color:${slc.color}">${val}</td>
          ${subRange ? `<td style="padding:4px 8px;font-size:8pt;color:${slc.color}">${esc(subRange.label||'')}</td>` : '<td></td>'}
        </tr>`;
      }).filter(Boolean).join('');
      if (subRows) {
        html += `<div style="padding:8px 14px;border-top:1px solid #F3F4F6">
          <div style="font-size:8pt;font-weight:700;color:#6B7280;margin-bottom:5px;text-transform:uppercase">По подшкалам</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB">
            <thead style="background:#F9FAFB"><tr>
              <th style="padding:4px 8px;text-align:left;font-size:8pt;color:#6B7280">Подшкала</th>
              <th style="padding:4px 8px;text-align:left;font-size:8pt;color:#6B7280">Баллы</th>
              <th style="padding:4px 8px;text-align:left;font-size:8pt;color:#6B7280">Уровень</th>
            </tr></thead>
            <tbody>${subRows}</tbody>
          </table>
        </div>`;
      }
    }

    // Вопросы и ответы
    const answerable = elems.filter(e => e.type !== 'info');
    if (answerable.length) {
      const rows = answerable.map((elem, qi) => {
        const ans = answers[elem.id];
        let ansText = '—';
        if (ans != null) {
          if (typeof ans === 'string') ansText = ans;
          else if (ans.value != null) ansText = String(ans.value);
          else if (ans.label != null) ansText = String(ans.label);
          else if (ans.optLabel != null) ansText = String(ans.optLabel);
          else ansText = JSON.stringify(ans);
        }
        return `<tr>
          <td style="padding:4px 8px;font-size:8pt;color:#6B7280;width:26px;text-align:center">${qi+1}</td>
          <td style="padding:4px 8px;font-size:8.5pt;color:#374151">${esc(elem.stimulus && elem.stimulus.text ? elem.stimulus.text : '')}</td>
          <td style="padding:4px 8px;font-size:8.5pt;font-weight:500;color:#111827">${esc(ansText)}</td>
        </tr>`;
      }).join('');
      html += `<div style="padding:8px 14px;border-top:1px solid #F3F4F6">
        <div style="font-size:8pt;font-weight:700;color:#6B7280;margin-bottom:5px;text-transform:uppercase">Ответы</div>
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:#F9FAFB"><tr>
            <th style="padding:4px 8px;font-size:8pt;color:#6B7280;width:26px">#</th>
            <th style="padding:4px 8px;text-align:left;font-size:8pt;color:#6B7280">Вопрос</th>
            <th style="padding:4px 8px;text-align:left;font-size:8pt;color:#6B7280">Ответ</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    return html;
  }

  // ── Рендер пользовательского v1 опросника (старый формат) ────────────────
  function v1CustomBlock(answers) {
    // v1 saves {answers: {qId: {index, label}}, notes: {qId: text}}
    const ans   = answers.answers || answers;
    const notes = answers.notes   || {};
    const rows = [];
    Object.entries(ans).forEach(([k, v]) => {
      const label = typeof v === 'object' ? (v.label || v.value || JSON.stringify(v)) : String(v);
      rows.push(`<tr>
        <td style="padding:3px 7px;font-size:8pt;color:#6B7280">Вопрос ${k}</td>
        <td style="padding:3px 7px;font-size:8.5pt;color:#111827">${esc(label)}</td>
      </tr>`);
    });
    Object.entries(notes).forEach(([k, v]) => {
      if (!v || !String(v).trim()) return;
      rows.push(`<tr>
        <td style="padding:3px 7px;font-size:8pt;color:#6B7280">Заметка ${k}</td>
        <td style="padding:3px 7px;font-size:8.5pt;color:#374151;font-style:italic">${esc(v)}</td>
      </tr>`);
    });
    if (!rows.length) return '';
    return `<div style="padding:8px 14px;border-top:1px solid #F3F4F6">
      <div style="font-size:8pt;font-weight:700;color:#6B7280;margin-bottom:5px;text-transform:uppercase">Ответы</div>
      <table style="width:100%;border-collapse:collapse">${rows.join('')}</table>
    </div>`;
  }

  // ── Блок диагностики ────────────────────────────────────────────────────
  function diagBlock(r) {
    const li    = levelInfo(r.level);
    const dname = esc(r.name || r.method_name || 'Диагностика');
    const date  = fmtDate(r.completed_at);
    const markers = (r.markers || []).map(m => `<li>${esc(m)}</li>`).join('');
    const risks   = (r.risks   || []).map(m => `<li class="risk-item">${esc(m)}</li>`).join('');

    let extra = '';
    try {
      const sc = typeof r.raw_scores === 'object' ? r.raw_scores : {};

      if (r.method_id === 'luscher' && sc.avgPos) {
        extra += `<div class="chart-wrap">${luscherRowSVG(sc.avgPos)}</div>`;
      }
      if (r.method_id === 'luria10' && sc.immediate) {
        extra += `<div class="chart-wrap">${luriaCurve([...sc.immediate, ...(sc.delayed != null ? [sc.delayed] : [])])}</div>`;
      }
      if (r.method_id === 'phillips' && sc.factors) {
        const frows = Object.entries(sc.factors).filter(([k])=>k!=='general').map(([k,f])=>{
          const col = f.pct>=75?'#E11D48':f.pct>=50?'#D97706':'#059669';
          return `<tr>
            <td style="padding:3px 7px;font-size:8.5pt">${esc(f.name||k)}</td>
            <td style="padding:3px 7px;width:130px">
              <div style="height:7px;background:#F3F4F6;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${f.pct}%;background:${col}"></div>
              </div>
            </td>
            <td style="padding:3px 7px;font-size:8.5pt;font-weight:700;color:${col}">${f.pct}%</td>
          </tr>`;
        }).join('');
        extra += `<div class="chart-wrap"><table style="width:100%;border-collapse:collapse">${frows}</table></div>`;
      }
      if (r.method_id === 'vas' && sc.sliders) {
        const VN={mood:'Настроение',energy:'Энергия',anxiety:'Тревога',interest:'Интерес',comfort:'Комфорт'};
        const VC={mood:'#4F46E5',energy:'#059669',anxiety:'#E11D48',interest:'#D97706',comfort:'#0D9488'};
        const vrows = Object.entries(sc.sliders).map(([k,v])=>{
          const col = VC[k]||'#4F46E5';
          return `<tr>
            <td style="padding:3px 7px;font-size:8.5pt">${esc(VN[k]||k)}</td>
            <td style="padding:3px 7px;width:130px">
              <div style="height:7px;background:#F3F4F6;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${v*10}%;background:${col}"></div>
              </div>
            </td>
            <td style="padding:3px 7px;font-size:8.5pt;font-weight:700;color:${col}">${v}/10</td>
          </tr>`;
        }).join('');
        extra += `<div class="chart-wrap"><table style="width:100%;border-collapse:collapse">${vrows}</table></div>`;
      }
      if (r.method_id === 'ebbinghaus_fill_blank' && sc.detail) {
        const labels={1:'тучи/облака',2:'метель',3:'хлопьями',4:'зверь',5:'волк',6:'улицы',7:'трудом',8:'снегу',9:'одета',10:'мешали',11:'пальто',12:'платок',13:'остановилась',14:'искать',15:'колени',16:'рыть'};
        const ebbRows = Object.entries(sc.detail).map(([id,d])=>{
          const col=d.ok?'#059669':'#E11D48', bg=d.ok?'#ECFDF5':'#FFF1F2';
          return `<tr>
            <td style="padding:2px 6px;font-size:8pt;color:#6B7280">${id}.</td>
            <td style="padding:2px 6px;font-size:8pt;color:#6B7280">${labels[id]||''}</td>
            <td style="padding:2px 6px;font-size:8pt;font-weight:600;color:${col};background:${bg}">${esc(d.answer||'—')}</td>
            <td style="padding:2px 6px;font-size:8pt;color:${col}">${d.ok?'✓':'✗'}</td>
          </tr>`;
        }).join('');
        extra += `<div class="chart-wrap">
          <div style="font-size:8.5pt;margin-bottom:5px">Правильных: <b>${sc.correct||0} из ${sc.total||16}</b></div>
          <table style="width:100%;border-collapse:collapse">${ebbRows}</table>
          ${sc.notes?`<div style="margin-top:6px;font-size:8pt;color:#6B7280;font-style:italic">${esc(sc.notes)}</div>`:''}
        </div>`;
      }
      if (r.method_id === 'san_wellbeing' && sc['С'] != null) {
        extra += `<div class="chart-wrap">
          ${sanProfileSVG(sc)}
          <div style="font-size:8pt;color:#9CA3AF;margin-top:3px">Пунктир = норма. Шкала 1–7.</div>
        </div>`;
      }
      if (r.method_id === 'ost_rusalov' && sc.ER != null && sc.valid !== false) {
        extra += `<div class="chart-wrap">
          <div style="font-size:8.5pt;margin-bottom:5px">К = ${sc.K||0} ${(sc.K||0)<7?'(норм.)':'⚠ протокол под вопросом'}</div>
          ${ostProfileSVG(sc)}
          <div style="font-size:8pt;color:#9CA3AF;margin-top:3px">│ низк. 0–4 │ средн. 5–8 │ высок. 9–12 │</div>
        </div>`;
      }
      if (r.method_id === 'rokich_values' && sc.terminal_ideal && sc.terminal_ideal.length) {
        const TL=[
          {id:'T1',t:'Активная деятельная жизнь'},{id:'T2',t:'Жизненная мудрость'},{id:'T3',t:'Здоровье'},
          {id:'T4',t:'Интересная работа'},{id:'T5',t:'Красота природы и искусства'},{id:'T6',t:'Любовь'},
          {id:'T7',t:'Материально обеспеченная жизнь'},{id:'T8',t:'Хорошие и верные друзья'},{id:'T9',t:'Общественное признание'},
          {id:'T10',t:'Познание'},{id:'T11',t:'Продуктивная жизнь'},{id:'T12',t:'Развитие'},
          {id:'T13',t:'Развлечения'},{id:'T14',t:'Свобода'},{id:'T15',t:'Счастливая семейная жизнь'},
          {id:'T16',t:'Счастье других'},{id:'T17',t:'Творчество'},{id:'T18',t:'Уверенность в себе'},
        ];
        const IL=[
          {id:'I1',t:'Аккуратность'},{id:'I2',t:'Воспитанность'},{id:'I3',t:'Высокие запросы'},
          {id:'I4',t:'Жизнерадостность'},{id:'I5',t:'Исполнительность'},{id:'I6',t:'Независимость'},
          {id:'I7',t:'Непримиримость к недостаткам'},{id:'I8',t:'Образованность'},{id:'I9',t:'Ответственность'},
          {id:'I10',t:'Рационализм'},{id:'I11',t:'Самоконтроль'},{id:'I12',t:'Смелость в отстаивании мнения'},
          {id:'I13',t:'Твёрдая воля'},{id:'I14',t:'Терпимость'},{id:'I15',t:'Широта взглядов'},
          {id:'I16',t:'Честность'},{id:'I17',t:'Эффективность в делах'},{id:'I18',t:'Чуткость'},
        ];
        extra += `<div class="chart-wrap">
          ${rokichTopHTML(TL, sc.terminal_actual, sc.terminal_ideal, sc.terminal_deltas||{}, 'Терминальные ценности')}
          ${rokichTopHTML(IL, sc.instrumental_actual, sc.instrumental_ideal, sc.instrumental_deltas||{}, 'Инструментальные ценности')}
          <div style="font-size:8pt;color:#9CA3AF">Δ — расхождение рангов идеал/реальность; ≥7 выделено красным.</div>
        </div>`;
      }
      if (r.method_id === 'personal_expectations_child' && sc.responses) {
        const SL=['Ситуация 1 (помощь)','Ситуация 2 (проволока)','Ситуация 3 (кукла)','Ситуация 4 (карандаши)'];
        const peRows=['r1','r2','r3','r4'].map((key,i)=>{
          const ans=sc.responses[key]||'';
          if (!ans.trim()) return '';
          return `<tr>
            <td style="padding:3px 7px;font-size:8pt;color:#6B7280;width:120px">${SL[i]}</td>
            <td style="padding:3px 7px;font-size:8.5pt">${esc(ans)}</td>
          </tr>`;
        }).filter(Boolean).join('');
        if (peRows) {
          extra += `<div class="chart-wrap">
            <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB">
              <thead style="background:#F9FAFB"><tr>
                <th style="padding:4px 7px;text-align:left;font-size:8pt;color:#6B7280">Ситуация</th>
                <th style="padding:4px 7px;text-align:left;font-size:8pt;color:#6B7280">Ответ</th>
              </tr></thead>
              <tbody>${peRows}</tbody>
            </table>
            ${sc.summary?`<div style="margin-top:8px;padding:7px 9px;background:#EEF2FF;border-radius:4px;font-size:8.5pt">
              <b style="color:#4F46E5">Заключение: </b>${esc(sc.summary)}</div>`:''}
          </div>`;
        }
      }
      if (r.psychologist_notes && r.psychologist_notes.trim()) {
        extra += `<div style="padding:8px 14px;background:#FAFAFA;border-top:1px solid #F3F4F6">
          <div style="font-size:8pt;font-weight:700;color:#6B7280;margin-bottom:3px">ЗАМЕТКИ ПСИХОЛОГА</div>
          <div style="font-size:9pt;color:#374151;line-height:1.6">${esc(r.psychologist_notes)}</div>
        </div>`;
      }

      // ── Пользовательский/импортированный опросник v2 ──────────────────────
      if (!r.method_id && r.diag_data && r.diag_data.version === 2) {
        extra += v2CustomBlock(r.diag_data, r.answers, r.raw_scores);
      }

      // ── Пользовательский опросник v1 (старый формат — массив вопросов) ────
      if (!r.method_id && !r.diag_data && r.answers) {
        extra += v1CustomBlock(r.answers);
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
