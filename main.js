const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { buildReportHTML } = require('./report_template');
const path = require('path');
const fs   = require('fs');

// ── Auto-updater ──────────────────────────────────────────────────────────────
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload        = false; // скачиваем только по запросу
  autoUpdater.autoInstallOnAppQuit = true;  // ставим при следующем закрытии
  autoUpdater.logger = null; // отключить логи в продакшне
} catch(e) { /* в dev-режиме без electron-updater — ничего страшного */ }

// ── sql.js — чистый JS, без компиляции ──────────────────────────────────────
let db;

function getDbPath() {
  return path.join(app.getPath('userData'), 'yasnaya-gran.db');
}

function saveDb() {
  try {
    const data = db.export();
    fs.writeFileSync(getDbPath(), Buffer.from(data));
  } catch(e) { console.error('saveDb error', e); }
}

async function initDatabase() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT DEFAULT '',
      birth_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366F1',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium',
      category_id INTEGER,
      content TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      exercise_ids TEXT DEFAULT '[]',
      is_template INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS exercise_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER,
      student_id INTEGER,
      score TEXT DEFAULT '',
      correct INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      duration_sec INTEGER DEFAULT 0,
      answers TEXT DEFAULT '[]',
      completed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS diagnostics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      fill_by TEXT DEFAULT 'teacher',
      questions TEXT DEFAULT '[]',
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS diagnostic_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diagnostic_id INTEGER,
      student_id INTEGER,
      answers TEXT DEFAULT '{}',
      scores TEXT DEFAULT '{}',
      summary TEXT DEFAULT '',
      completed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Дефолтные категории
  const cats = db.exec("SELECT COUNT(*) as n FROM categories");
  if (cats[0].values[0][0] === 0) {
    db.run(`INSERT INTO categories (name, color, sort_order) VALUES
      ('Внимание', '#6366F1', 1),
      ('Память',   '#10B981', 2),
      ('Логика',   '#F59E0B', 3),
      ('Речь',     '#EF4444', 4)`);
  }

  // ── Миграция: find_pairs → memory_game ──────────────────────────────────────
  try {
    db.run("UPDATE exercises SET type = 'memory_game' WHERE type = 'find_pairs'");
  } catch(e) { console.warn('migration find_pairs→memory_game:', e.message); }

  saveDb();
}

// ── Хелперы запросов ─────────────────────────────────────────────────────────
function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch(e) { console.error('queryAll error:', sql, e); return []; }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    // Получить последний вставленный id
    const r = db.exec("SELECT last_insert_rowid() as id");
    const id = r[0]?.values[0][0];
    saveDb();
    return { lastInsertRowid: id };
  } catch(e) { console.error('run error:', sql, e); return { lastInsertRowid: null }; }
}

// ── Electron window ──────────────────────────────────────────────────────────
let mainWin = null;

async function createWindow() {
  let windowed = true; // по умолчанию — оконный режим
  try {
    const r = db.exec(`SELECT value FROM settings WHERE key = 'fullscreen_mode'`);
    if (r.length && r[0].values.length) {
      windowed = JSON.parse(r[0].values[0][0]) !== true;
    }
  } catch(e) {}

  const isDev = process.argv.includes('--dev');

  mainWin = new BrowserWindow({
    width: 1280, height: 820,
    minWidth: 1024, minHeight: 680,
    backgroundColor: '#0F0F0F',
    fullscreen: !isDev && !windowed,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  mainWin.removeMenu();
  mainWin.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWin.once('ready-to-show', () => {
    mainWin.show();
    mainWin.webContents.send('window:mode', windowed ? 'windowed' : 'fullscreen');
  });
  mainWin.on('maximize',   () => mainWin.webContents.send('window:state', { maximized: true }));
  mainWin.on('unmaximize', () => mainWin.webContents.send('window:state', { maximized: false }));
  if (isDev) mainWin.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(async () => {
  await initDatabase();
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

  // ── Автообновление: проверяем через 3 сек после запуска ──────────────────
  if (autoUpdater && !process.argv.includes('--dev')) {
    autoUpdater.on('update-available', (info) => {
      mainWin?.webContents.send('updater:available', {
        version: info.version,
        releaseNotes: info.releaseNotes || '',
      });
    });
    autoUpdater.on('update-not-available', () => {
      mainWin?.webContents.send('updater:not-available');
    });
    autoUpdater.on('download-progress', (p) => {
      mainWin?.webContents.send('updater:progress', Math.round(p.percent));
    });
    autoUpdater.on('update-downloaded', () => {
      mainWin?.webContents.send('updater:downloaded');
    });
    autoUpdater.on('error', (err) => {
      mainWin?.webContents.send('updater:error', err.message);
    });

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 3000);
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC — Ученики ────────────────────────────────────────────────────────────
ipcMain.handle('students:getAll', () => {
  return queryAll(`
    SELECT s.*,
      (SELECT COUNT(*) FROM exercise_results WHERE student_id = s.id) as exercise_count,
      (SELECT summary FROM diagnostic_results WHERE student_id = s.id ORDER BY completed_at DESC LIMIT 1) as last_diagnostic
    FROM students s ORDER BY s.first_name, s.last_name
  `);
});

ipcMain.handle('students:get', (_, id) =>
  queryOne('SELECT * FROM students WHERE id = ?', [id])
);

ipcMain.handle('students:create', (_, d) => {
  const r = run('INSERT INTO students (first_name, last_name, birth_date, notes) VALUES (?,?,?,?)',
    [d.first_name, d.last_name||'', d.birth_date||'', d.notes||'']);
  return { id: r.lastInsertRowid, ...d };
});

ipcMain.handle('students:update', (_, d) => {
  run('UPDATE students SET first_name=?, last_name=?, birth_date=?, notes=? WHERE id=?',
    [d.first_name, d.last_name||'', d.birth_date||'', d.notes||'', d.id]);
  return d;
});

ipcMain.handle('students:delete', (_, id) => {
  run('DELETE FROM students WHERE id=?', [id]);
  return { ok: true };
});

ipcMain.handle('students:getHistory', (_, sid) => {
  const exercises = queryAll(`
    SELECT er.*, e.name as exercise_name, e.type as exercise_type
    FROM exercise_results er LEFT JOIN exercises e ON er.exercise_id = e.id
    WHERE er.student_id = ? ORDER BY er.completed_at DESC`, [sid]);
  const diagnostics = queryAll(`
    SELECT dr.*, d.name as diagnostic_name
    FROM diagnostic_results dr LEFT JOIN diagnostics d ON dr.diagnostic_id = d.id
    WHERE dr.student_id = ? ORDER BY dr.completed_at DESC`, [sid]);
  return { exercises, diagnostics };
});

// ── IPC — Категории ──────────────────────────────────────────────────────────
ipcMain.handle('categories:getAll', () =>
  queryAll('SELECT * FROM categories ORDER BY sort_order, name')
);
ipcMain.handle('categories:create', (_, d) => {
  const r = run('INSERT INTO categories (name, color) VALUES (?,?)', [d.name, d.color||'#6366F1']);
  return { id: r.lastInsertRowid, ...d };
});
ipcMain.handle('categories:delete', (_, id) => {
  run('DELETE FROM categories WHERE id=?', [id]);
  return { ok: true };
});

// ── IPC — Упражнения ─────────────────────────────────────────────────────────
ipcMain.handle('exercises:getAll', () =>
  queryAll(`SELECT e.*, c.name as category_name, c.color as category_color
    FROM exercises e LEFT JOIN categories c ON e.category_id = c.id
    ORDER BY e.created_at DESC`)
);
ipcMain.handle('exercises:get', (_, id) =>
  queryOne(`SELECT e.*, c.name as category_name, c.color as category_color
    FROM exercises e LEFT JOIN categories c ON e.category_id = c.id WHERE e.id=?`, [id])
);
ipcMain.handle('exercises:create', (_, d) => {
  // content может прийти строкой (из БД при импорте) или объектом (из редактора) — нормализуем
  const contentStr = typeof d.content === 'string' ? d.content : JSON.stringify(d.content || {});
  const r = run('INSERT INTO exercises (name, type, difficulty, category_id, content) VALUES (?,?,?,?,?)',
    [d.name, d.type, d.difficulty||'medium', d.category_id||null, contentStr]);
  return { id: r.lastInsertRowid, ...d };
});
ipcMain.handle('exercises:update', (_, d) => {
  const contentStr = typeof d.content === 'string' ? d.content : JSON.stringify(d.content || {});
  run(`UPDATE exercises SET name=?, type=?, difficulty=?, category_id=?, content=?,
    updated_at=datetime('now') WHERE id=?`,
    [d.name, d.type, d.difficulty||'medium', d.category_id||null, contentStr, d.id]);
  return d;
});
ipcMain.handle('exercises:delete', (_, id) => {
  run('DELETE FROM exercises WHERE id=?', [id]);
  return { ok: true };
});

// ── IPC — Занятия ────────────────────────────────────────────────────────────
ipcMain.handle('sessions:getAll', () =>
  queryAll(`SELECT s.*, c.name as category_name, c.color as category_color
    FROM sessions s LEFT JOIN categories c ON s.category_id = c.id
    ORDER BY s.is_template DESC, s.created_at DESC`)
);
ipcMain.handle('sessions:create', (_, d) => {
  const r = run('INSERT INTO sessions (name, category_id, exercise_ids, is_template) VALUES (?,?,?,?)',
    [d.name, d.category_id||null, JSON.stringify(d.exercise_ids||[]), d.is_template?1:0]);
  return { id: r.lastInsertRowid, ...d };
});
ipcMain.handle('sessions:update', (_, d) => {
  run('UPDATE sessions SET name=?, category_id=?, exercise_ids=?, is_template=? WHERE id=?',
    [d.name, d.category_id||null, JSON.stringify(d.exercise_ids||[]), d.is_template?1:0, d.id]);
  return d;
});
ipcMain.handle('sessions:delete', (_, id) => {
  run('DELETE FROM sessions WHERE id=?', [id]);
  return { ok: true };
});

// ── IPC — Диагностики ────────────────────────────────────────────────────────
ipcMain.handle('diagnostics:getAll', () =>
  queryAll('SELECT * FROM diagnostics ORDER BY is_builtin DESC, name')
);
ipcMain.handle('diagnostics:create', (_, d) => {
  const qStr = typeof d.questions === 'string'
    ? d.questions
    : JSON.stringify(d.questions || []);
  const r = run('INSERT INTO diagnostics (name, description, fill_by, questions) VALUES (?,?,?,?)',
    [d.name, d.description||'', d.fill_by||'teacher', qStr]);
  return { id: r.lastInsertRowid, ...d };
});
ipcMain.handle('diagnostics:delete', (_, id) => {
  run('DELETE FROM diagnostics WHERE id=?', [id]);
  return { ok: true };
});
ipcMain.handle('diagnostics:saveResult', (_, d) => {
  // Migration-safe column additions
  try { run("ALTER TABLE diagnostic_results ADD COLUMN method_id TEXT"); } catch(e) {}
  try { run("ALTER TABLE diagnostic_results ADD COLUMN method_name TEXT"); } catch(e) {}
  try { run("ALTER TABLE diagnostic_results ADD COLUMN psychologist_notes TEXT DEFAULT ''"); } catch(e) {}
  const r = run(
    'INSERT INTO diagnostic_results (diagnostic_id, student_id, answers, scores, summary, method_id, method_name, psychologist_notes) VALUES (?,?,?,?,?,?,?,?)',
    [d.diagnostic_id||null, d.student_id||null,
     JSON.stringify(d.answers||{}), JSON.stringify(d.scores||{}),
     d.summary||'', d.method_id||null, d.method_name||null, d.psychologist_notes||'']);
  return { id: r.lastInsertRowid };
});

// Получить историю результатов по конкретной диагностике + ученик
ipcMain.handle('diagnostics:getHistory', (_, { diagnostic_id, student_id }) => {
  try { run("ALTER TABLE diagnostic_results ADD COLUMN psychologist_notes TEXT DEFAULT ''"); } catch(e) {}
  return queryAll(
    `SELECT id, scores, summary, completed_at, psychologist_notes
     FROM diagnostic_results
     WHERE diagnostic_id = ? AND student_id = ?
     ORDER BY completed_at ASC`,
    [diagnostic_id, student_id]
  );
});

// Обновить заметки психолога по результату
ipcMain.handle('diagnostics:updateNotes', (_, { result_id, notes }) => {
  try { run("ALTER TABLE diagnostic_results ADD COLUMN psychologist_notes TEXT DEFAULT ''"); } catch(e) {}
  run('UPDATE diagnostic_results SET psychologist_notes = ? WHERE id = ?', [notes, result_id]);
  saveDb();
  return { ok: true };
});

// ── IPC — Файлы ──────────────────────────────────────────────────────────────
ipcMain.handle('files:pickImage', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Изображения', extensions: ['png','jpg','jpeg','gif','webp','svg'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const src  = result.filePaths[0];
  const dir  = path.join(app.getPath('userData'), 'images');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${Date.now()}_${path.basename(src)}`);
  fs.copyFileSync(src, dest);
  return dest;
});

ipcMain.handle('files:getImageData', (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext  = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
});

ipcMain.handle('files:pickJson', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
});

// ── IPC — Результаты упражнений ──────────────────────────────────────────────
ipcMain.handle('exercises:saveResult', (_, d) => {
  const answersStr = typeof d.answers === 'string' ? d.answers : JSON.stringify(d.answers || []);
  run(`INSERT INTO exercise_results
    (student_id, exercise_id, score, correct, total, duration_sec, answers, completed_at)
    VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    [d.student_id||null, d.exercise_id||null, d.score||'', d.correct||0,
     d.total||0, d.duration_sec||0, answersStr]);
  return { ok: true };
});

ipcMain.handle('sessions:get', (_, id) =>
  queryOne(`SELECT s.*, c.name as category_name, c.color as category_color
    FROM sessions s LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.id = ?`, [id])
);

ipcMain.handle('diagnostics:get', (_, id) =>
  queryOne('SELECT * FROM diagnostics WHERE id = ?', [id])
);

ipcMain.handle('diagnostics:update', (_, d) => {
  const qStr = typeof d.questions === 'string'
    ? d.questions
    : JSON.stringify(d.questions || []);
  run(`UPDATE diagnostics SET name=?, description=?, fill_by=?, questions=? WHERE id=?`,
    [d.name, d.description||'', d.fill_by||'teacher', qStr, d.id]);
  return d;
});

// ── IPC — PDF Отчёт (Electron native, без Python) ────────────────────────────
ipcMain.handle('report:generate', async (_, studentId) => {
  const student = queryOne('SELECT * FROM students WHERE id=?', [studentId]);
  if (!student) return { error: 'Ученик не найден' };

  const ex_results = queryAll(`
    SELECT er.*, e.name as exercise_name, e.type as exercise_type
    FROM exercise_results er LEFT JOIN exercises e ON er.exercise_id = e.id
    WHERE er.student_id = ? ORDER BY er.completed_at DESC`, [studentId]);

  const diagRows = queryAll(`
    SELECT dr.*, d.name as diagnostic_name, dr.method_id, dr.method_name
    FROM diagnostic_results dr LEFT JOIN diagnostics d ON dr.diagnostic_id = d.id
    WHERE dr.student_id = ? ORDER BY dr.completed_at DESC`, [studentId]);

  const diag_results = diagRows.map(r => {
    let scores = {}, raw_scores = {};
    try { scores = JSON.parse(r.scores || '{}'); raw_scores = scores; } catch(e) {}
    return {
      name:         r.diagnostic_name || r.method_name || 'Диагностика',
      method_name:  r.method_name,
      method_id:    r.method_id,
      completed_at: r.completed_at,
      summary:      r.summary || '',
      level:        scores.level || 'norm',
      markers:      scores.markers || [],
      risks:        scores.risks   || [],
      raw_scores,
    };
  });

  const html = buildReportHTML({ student, diag_results, ex_results });

  // Создаём скрытое окно для рендера
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  const tmpDir  = app.getPath('temp');
  const pdfPath = path.join(tmpDir, `report_${studentId}_${Date.now()}.pdf`);

  try {
    const pdfData = await win.webContents.printToPDF({
      printBackground:  true,
      pageSize:         'A4',
      landscape:        false,
    });
    fs.writeFileSync(pdfPath, pdfData);
    win.close();
    return { path: pdfPath };
  } catch (err) {
    win.close();
    return { error: err.message };
  }
});

ipcMain.handle('report:open', (_, pdfPath) => {
  shell.openPath(pdfPath);
  return { ok: true };
});

ipcMain.handle('report:saveAs', async (_, pdfPath) => {
  const result = await dialog.showSaveDialog({
    defaultPath: path.basename(pdfPath),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.copyFileSync(pdfPath, result.filePath);
  return { path: result.filePath };
});

// ── IPC — Управление окном ────────────────────────────────────────────────────
ipcMain.handle('window:minimize',    () => { mainWin?.minimize(); });
ipcMain.handle('window:maximize',    () => { mainWin?.isMaximized() ? mainWin.unmaximize() : mainWin.maximize(); });
ipcMain.handle('window:close',       () => { mainWin?.close(); });
ipcMain.handle('window:isMaximized', () => mainWin?.isMaximized() ?? false);
ipcMain.handle('window:setMode', async (_, mode) => {
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('fullscreen_mode', ?)`,
    [JSON.stringify(mode === 'fullscreen')]);
  saveDb();
  if (mode === 'fullscreen') {
    mainWin?.setFullScreen(true);
    mainWin?.setResizable(false);
  } else {
    mainWin?.setFullScreen(false);
    mainWin?.setResizable(true);
  }
  mainWin?.webContents.send('window:mode', mode);
  return { ok: true };
});

// ── Выход из приложения ───────────────────────────────────────────────────────
ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:version', () => app.getVersion());

// ── IPC — Обновления ─────────────────────────────────────────────────────────
ipcMain.handle('updater:check',    () => {
  if (!autoUpdater) return { error: 'unavailable' };
  return autoUpdater.checkForUpdates().catch(e => ({ error: e.message }));
});
ipcMain.handle('updater:download', () => {
  if (!autoUpdater) return null;
  return autoUpdater.downloadUpdate().catch(e => ({ error: e.message }));
});
ipcMain.handle('updater:install',  () => {
  if (autoUpdater) autoUpdater.quitAndInstall();
});

// ── Настройки приложения ──────────────────────────────────────────────────────
ipcMain.handle('settings:get', (_, key) => {
  const r = db.exec(`SELECT value FROM settings WHERE key = ?`, [key]);
  if (!r.length || !r[0].values.length) return null;
  try { return JSON.parse(r[0].values[0][0]); } catch(e) { return r[0].values[0][0]; }
});
ipcMain.handle('settings:set', (_, key, value) => {
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)]);
  saveDb();
  return true;
});

ipcMain.handle('files:saveImageData', (_, dataUrl, idx) => {
  // Принимает data URL, сохраняет файл в папку images, возвращает путь
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const ext  = mime.split('/')[1].replace('jpeg','jpg').replace('svg+xml','svg');
  const dir  = path.join(app.getPath('userData'), 'images');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${Date.now()}_${idx || 0}_imported.${ext}`);
  fs.writeFileSync(dest, Buffer.from(m[2], 'base64'));
  return dest;
});

// ── Экспорт библиотеки упражнений и цепочек ──────────────────────────────────
ipcMain.handle('library:export', async (_, data) => {
  const { dialog } = require('electron');

  // Собрать все уникальные пути к картинкам из content всех упражнений
  // и встроить их как base64 в словарь images: { "C:\...\photo.jpg": "data:image/jpeg;base64,..." }
  const images = {};
  for (const ex of (data.exercises || [])) {
    const contentStr = typeof ex.content === 'string' ? ex.content : JSON.stringify(ex.content || {});
    // Ищем строки в JSON, похожие на абсолютные пути (содержат / или \ и расширение изображения)
    const matches = contentStr.match(/"([^"]+\.(?:png|jpg|jpeg|gif|webp|svg))"/gi) || [];
    for (const m of matches) {
      const p = m.slice(1, -1); // убрать кавычки
      if (!images[p] && !p.startsWith('data:') && fs.existsSync(p)) {
        try {
          const ext  = path.extname(p).slice(1).toLowerCase();
          const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          images[p] = `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
        } catch(e) { /* пропустить нечитаемый файл */ }
      }
    }
  }
  data.images = images;

  const result = await dialog.showSaveDialog(mainWin, {
    title: 'Сохранить библиотеку',
    defaultPath: `vekha_library_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'Библиотека Вехи (JSON)', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
  const imgCount = Object.keys(images).length;
  return { ok: true, path: result.filePath, imgCount };
});

ipcMain.handle('library:import', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWin, {
    title: 'Открыть библиотеку',
    filters: [{ name: 'Библиотека Вехи (JSON)', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch(e) {
    return { error: 'Не удалось прочитать файл: ' + e.message };
  }
});
