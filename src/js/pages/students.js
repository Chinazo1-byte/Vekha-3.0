// ── Страница «Ученики» ────────────────────────────────────────────────────────
Router.register('students', loadStudentsPage);

let _students = [];
let _studentsSearch = '';

async function loadStudentsPage() {
  _students = await window.db.students.getAll();
  renderStudentsPage();
}

function renderStudentsPage() {
  const page     = document.getElementById('page-students');
  const filtered = _students.filter(s => {
    const q = _studentsSearch.toLowerCase();
    return !q || (s.first_name||'').toLowerCase().includes(q) || (s.last_name||'').toLowerCase().includes(q);
  });

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Ученики</h1>
        <p class="page-subtitle">${_students.length} ${plural(_students.length,'ученик','ученика','учеников')}</p>
      </div>
      <div class="page-actions">
        <div class="search-bar">
          ${Icons.search}
          <input type="text" placeholder="Поиск..." id="student-search" value="${escHtml(_studentsSearch)}">
        </div>
        <button class="btn btn-primary" id="btn-add-student">${Icons.plus} Добавить ученика</button>
      </div>
    </div>
    ${filtered.length === 0 ? renderStudentsEmpty() : `
      <div class="student-grid">
        ${filtered.map(renderStudentCard).join('')}
      </div>`}
  `;

  document.getElementById('student-search')?.addEventListener('input', e => {
    _studentsSearch = e.target.value;
    renderStudentsPage();
  });
  document.getElementById('btn-add-student')?.addEventListener('click', () => openAddStudentModal());

  page.querySelectorAll('.student-card[data-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-actions')) return;
      openStudentProfile(parseInt(card.dataset.id));
    });
  });

  page.querySelectorAll('.btn-delete-student').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const s  = _students.find(s => s.id === id);
      Modal.confirm('Удалить ученика',
        `Удалить <b>${escHtml(s?.first_name)} ${escHtml(s?.last_name||'')}</b>? Все данные будут удалены.`,
        async () => {
          await window.db.students.delete(id);
          toast('Ученик удалён');
          await loadStudentsPage();
        });
    });
  });
}

function renderStudentsEmpty() {
  if (_studentsSearch) return `
    <div class="empty-state">
      <div class="empty-illustration">${Icons.search}</div>
      <div class="empty-title">Ничего не найдено</div>
    </div>`;
  return `
    <div class="empty-state">
      <div class="empty-illustration">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="14" cy="12" r="7" stroke="#9C9C94" stroke-width="2"/>
          <path d="M4 32c0-5.523 4.477-9 10-9s10 3.477 10 9" stroke="#9C9C94" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="empty-title">Пока нет учеников</div>
      <div class="empty-text">Добавьте ученика, чтобы начать вести записи и отслеживать прогресс</div>
      <button class="btn btn-primary" onclick="openAddStudentModal()">${Icons.plus} Добавить ученика</button>
    </div>`;
}

function renderStudentCard(s) {
  const color = avatarColor(s.id);
  const inits = initials(s.first_name, s.last_name);
  const count = s.exercise_count || 0;
  return `
    <div class="student-card card-clickable" data-id="${s.id}">
      <div class="card-actions">
        <button class="btn btn-icon btn-ghost btn-delete-student" data-id="${s.id}">${Icons.trash}</button>
      </div>
      <div class="student-avatar" style="background:${color}">${escHtml(inits)}</div>
      <div class="student-name">${escHtml(s.first_name)} ${escHtml(s.last_name||'')}</div>
      <div class="student-meta">${s.birth_date ? fmtDate(s.birth_date) : 'Дата не указана'}</div>
      <span class="student-badge" style="${count===0?'background:var(--surface-2);color:var(--text-3)':''}">
        ${count > 0 ? `${count} ${plural(count,'занятие','занятия','занятий')}` : 'Нет занятий'}
      </span>
    </div>`;
}

// ── Добавить / редактировать ──────────────────────────────────────────────────
function openAddStudentModal(existing) {
  const isEdit = !!existing;
  Modal.open(
    isEdit ? 'Редактировать ученика' : 'Новый ученик',
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">Имя</label>
          <input class="input-field" id="s-fname" placeholder="Иван" value="${escHtml(existing?.first_name||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Фамилия</label>
          <input class="input-field" id="s-lname" placeholder="Иванов" value="${escHtml(existing?.last_name||'')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Дата рождения</label>
        <input class="input-field" id="s-bdate" type="date" value="${existing?.birth_date||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Примечания</label>
        <textarea class="input-field" id="s-notes" placeholder="Особенности, цели работы...">${escHtml(existing?.notes||'')}</textarea>
      </div>
    </div>`,
    `<button class="btn btn-ghost" id="s-cancel">Отмена</button>
     <button class="btn btn-primary" id="btn-save-student">${isEdit ? 'Сохранить' : 'Добавить'}</button>`, 'Удалить', true
  );
  document.getElementById('s-cancel').addEventListener('click', () => Modal.close());
  document.getElementById('btn-save-student').addEventListener('click', async () => {
    const fname = document.getElementById('s-fname').value.trim();
    if (!fname) { toast('Введите имя', 'error'); return; }
    const data = {
      first_name: fname,
      last_name:  document.getElementById('s-lname').value.trim(),
      birth_date: document.getElementById('s-bdate').value,
      notes:      document.getElementById('s-notes').value.trim(),
    };
    if (isEdit) {
      await window.db.students.update({ id: existing.id, ...data });
      toast('Сохранено', 'success');
      Modal.close();
      openStudentProfile(existing.id);
    } else {
      await window.db.students.create(data);
      toast('Ученик добавлен', 'success');
      Modal.close();
      await loadStudentsPage();
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  ПРОФИЛЬ УЧЕНИКА — полноэкранная панель с анкетой и прогрессом
// ══════════════════════════════════════════════════════════════════════════════
let _profileEl = null;

async function openStudentProfile(id) {
  const s       = await window.db.students.get(id);
  const history = await window.db.students.getHistory(id);
  if (!s) return;

  _profileEl?.remove();
  const el = document.createElement('div');
  el.id = 'student-profile';
  el.style.cssText = `
    position:fixed;inset:0;background:var(--bg);z-index:150;
    display:flex;flex-direction:column;animation:pageFade .2s ease;overflow:hidden`;
  document.body.appendChild(el);
  _profileEl = el;

  const color = avatarColor(s.id);
  const inits = initials(s.first_name, s.last_name);
  const exList = history.exercises;
  const diagList = history.diagnostics;

  // Считаем прогресс
  const totalEx    = exList.length;
  const totalRight = exList.reduce((sum, r) => sum + (r.correct||0), 0);
  const totalItems = exList.reduce((sum, r) => sum + (r.total||0), 0);
  const avgPct     = totalItems > 0 ? Math.round(totalRight / totalItems * 100) : null;

  // Последние 10 результатов для мини-графика
  const chartData = exList.slice(0, 10).reverse().map((r, i) => ({
    i, pct: r.total > 0 ? Math.round(r.correct/r.total*100) : 0,
    name: r.exercise_name || '—'
  }));

  el.innerHTML = `
    <!-- Topbar -->
    <div style="height:60px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 28px;gap:16px;flex-shrink:0">
      <button class="btn btn-ghost btn-sm" id="profile-back">${Icons.back} Назад</button>
      <div style="font-family:var(--font-title);font-size:17px;font-weight:600">Профиль ученика</div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" id="profile-edit">${Icons.pencil} Редактировать</button>
        <button class="btn btn-primary btn-sm" id="profile-pdf">📄 Экспорт PDF</button>
      </div>
    </div>

    <!-- Content -->
    <div style="flex:1;overflow-y:auto;padding:36px 48px;display:grid;grid-template-columns:280px 1fr;gap:28px;align-items:start">

      <!-- Левая колонка: карточка ученика -->
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-2xl);padding:28px;text-align:center;margin-bottom:16px">
          <div style="width:72px;height:72px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-family:var(--font-title);font-size:26px;font-weight:600;color:#fff;margin:0 auto 14px">
            ${escHtml(inits)}
          </div>
          <div style="font-size:18px;font-weight:700;color:var(--text-1);margin-bottom:4px">
            ${escHtml(s.first_name)} ${escHtml(s.last_name||'')}
          </div>
          ${s.birth_date ? `<div style="font-size:13px;color:var(--text-3);margin-bottom:12px">${fmtDate(s.birth_date)}</div>` : ''}
          ${s.notes ? `
            <div style="background:var(--surface-2);border-radius:var(--r-md);padding:12px;font-size:13px;color:var(--text-2);line-height:1.6;text-align:left;margin-top:8px">
              ${escHtml(s.notes)}
            </div>` : ''}
        </div>

        <!-- Статистика -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat-card">
            <div class="stat-value">${totalEx}</div>
            <div class="stat-label">Упражнений</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${diagList.length}</div>
            <div class="stat-label">Диагностик</div>
          </div>
          <div class="stat-card" style="grid-column:span 2">
            <div class="stat-value" style="color:${avgPct===null?'var(--text-3)':avgPct>=80?'var(--green)':avgPct>=50?'var(--amber)':'var(--rose)'}">
              ${avgPct !== null ? avgPct + '%' : '—'}
            </div>
            <div class="stat-label">Средний результат</div>
          </div>
        </div>
      </div>

      <!-- Правая колонка: графики и история -->
      <div>
        <!-- Мини-график прогресса -->
        ${chartData.length >= 2 ? `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:20px;margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">
              Динамика результатов
            </div>
            <div style="position:relative;height:90px;display:flex;align-items:flex-end;gap:6px;padding-bottom:20px" id="progress-chart">
              ${chartData.map((d, i) => {
                const h = Math.max(4, Math.round(d.pct * 0.7));
                const col = d.pct >= 80 ? 'var(--green)' : d.pct >= 50 ? 'var(--amber)' : 'var(--rose)';
                return `
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:default" title="${escHtml(d.name)}: ${d.pct}%">
                    <div style="font-size:10px;color:var(--text-3);font-weight:600">${d.pct}%</div>
                    <div style="width:100%;background:${col};border-radius:4px 4px 0 0;height:${h}px;opacity:.85;transition:opacity .15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=.85"></div>
                  </div>`;
              }).join('')}
            </div>
          </div>` : ''}

        <!-- Вкладки -->
        <div style="display:flex;gap:0;margin-bottom:16px;background:var(--surface-2);border-radius:var(--r-md);padding:4px" id="profile-tabs">
          <button class="profile-tab active" data-tab="exercises" style="flex:1;padding:8px;border:none;background:var(--surface);border-radius:var(--r-sm);font-family:var(--font-ui);font-size:13px;font-weight:600;color:var(--text-1);cursor:pointer;transition:all .15s;box-shadow:var(--shadow-sm)">
            Упражнения (${exList.length})
          </button>
          <button class="profile-tab" data-tab="diagnostics" style="flex:1;padding:8px;border:none;background:transparent;border-radius:var(--r-sm);font-family:var(--font-ui);font-size:13px;font-weight:500;color:var(--text-3);cursor:pointer;transition:all .15s">
            Диагностики (${diagList.length})
          </button>
        </div>

        <!-- История упражнений -->
        <div id="tab-exercises">
          ${exList.length === 0
            ? `<div style="text-align:center;padding:40px;color:var(--text-3);font-size:13.5px">Упражнений ещё не было</div>`
            : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden">
                <table class="history-table">
                  <thead>
                    <tr>
                      <th>Упражнение</th>
                      <th>Тип</th>
                      <th>Результат</th>
                      <th>Время</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${exList.map(r => `
                      <tr>
                        <td style="font-weight:500">${escHtml(r.exercise_name||'—')}</td>
                        <td>${typeBadge(r.exercise_type)}</td>
                        <td>
                          ${r.total > 0
                            ? `<span class="score-pill ${scoreClass(r.correct,r.total)}">${fmtScore(r.correct,r.total)}</span>
                               <span style="font-size:11.5px;color:var(--text-3);margin-left:4px">${r.correct}/${r.total}</span>`
                            : '<span class="text-muted">—</span>'}
                        </td>
                        <td class="text-muted text-sm">${r.duration_sec ? r.duration_sec + ' с' : '—'}</td>
                        <td class="text-muted text-sm">${fmtDate(r.completed_at)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>

        <!-- История диагностик -->
        <div id="tab-diagnostics" class="hidden">
          ${diagList.length === 0
            ? `<div style="text-align:center;padding:40px;color:var(--text-3);font-size:13.5px">Диагностик ещё не проводилось</div>`
            : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden">
                <table class="history-table">
                  <thead><tr><th>Методика</th><th>Результат</th><th>Дата</th></tr></thead>
                  <tbody>
                    ${diagList.map(r => `
                      <tr>
                        <td style="font-weight:500">${escHtml(r.diagnostic_name||'—')}</td>
                        <td style="font-size:13px;color:var(--text-2)">${escHtml(r.summary||'—')}</td>
                        <td class="text-muted text-sm">${fmtDate(r.completed_at)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>
      </div>
    </div>
  `;

  el.querySelector('#profile-back').addEventListener('click', () => {
    _profileEl?.remove(); _profileEl = null;
  });
  el.querySelector('#profile-edit').addEventListener('click', () => openAddStudentModal(s));
  el.querySelector('#profile-pdf').addEventListener('click', () => exportStudentPdf(id, el));

  // Вкладки
  el.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.profile-tab').forEach(t => {
        t.style.background   = 'transparent';
        t.style.color        = 'var(--text-3)';
        t.style.fontWeight   = '500';
        t.style.boxShadow    = 'none';
      });
      tab.style.background = 'var(--surface)';
      tab.style.color      = 'var(--text-1)';
      tab.style.fontWeight = '600';
      tab.style.boxShadow  = 'var(--shadow-sm)';

      const target = tab.dataset.tab;
      el.querySelector('#tab-exercises').classList.toggle('hidden', target !== 'exercises');
      el.querySelector('#tab-diagnostics').classList.toggle('hidden', target !== 'diagnostics');
    });
  });
}

// ── Хелпер склонения ──────────────────────────────────────────────────────────
function plural(n, one, few, many) {
  const m  = Math.abs(n) % 100;
  const m1 = m % 10;
  if (m >= 11 && m <= 19) return many;
  if (m1 === 1) return one;
  if (m1 >= 2 && m1 <= 4) return few;
  return many;
}

// ── Экспорт PDF ───────────────────────────────────────────────────────────────
async function exportStudentPdf(studentId, profileEl) {
  const btn = profileEl?.querySelector('#profile-pdf');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Генерация...'; }

  try {
    const result = await window.db.report.generate(studentId);

    if (result?.error) {
      toast('Ошибка генерации PDF: ' + result.error, 'error');
      return;
    }

    // Показываем мини-баннер с кнопками
    showPdfBanner(result.path, profileEl);
  } catch (e) {
    toast('Не удалось создать отчёт', 'error');
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '📄 Экспорт PDF'; }
  }
}

function showPdfBanner(pdfPath, profileEl) {
  // Убираем старый баннер если есть
  profileEl?.querySelector('#pdf-banner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'pdf-banner';
  banner.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-xl); padding: 14px 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,.18);
    display: flex; align-items: center; gap: 14px;
    z-index: 300; animation: pageFade .2s ease;
    min-width: 320px;
  `;
  banner.innerHTML = `
    <div style="font-size:22px">📄</div>
    <div style="flex:1">
      <div style="font-size:13.5px;font-weight:600;color:var(--text-1)">PDF-отчёт готов</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:2px">Нажмите чтобы открыть или сохранить</div>
    </div>
    <button class="btn btn-ghost btn-sm" id="pdf-open">Открыть</button>
    <button class="btn btn-primary btn-sm" id="pdf-save">Сохранить как...</button>
    <button style="border:none;background:none;cursor:pointer;color:var(--text-3);font-size:18px;padding:0 4px;line-height:1" id="pdf-dismiss">×</button>
  `;
  document.body.appendChild(banner);

  banner.querySelector('#pdf-open').addEventListener('click', () => {
    window.db.report.open(pdfPath);
  });
  banner.querySelector('#pdf-save').addEventListener('click', async () => {
    const r = await window.db.report.saveAs(pdfPath);
    if (!r.canceled) toast('Сохранено: ' + r.path, 'success');
  });
  banner.querySelector('#pdf-dismiss').addEventListener('click', () => banner.remove());

  // Автоматически убираем через 15 сек
  setTimeout(() => banner?.remove(), 15000);
}
