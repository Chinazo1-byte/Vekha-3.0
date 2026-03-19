#!/usr/bin/env node
/**
 * scripts/bump.js — bump version, commit, tag, push
 * Usage: node scripts/bump.js [patch|minor|major]
 *
 * Находит git автоматически: сначала в PATH, потом в стандартных
 * местах установки Git for Windows.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Найти git ─────────────────────────────────────────────────────────────────
function findGit() {
  // 1. Попробовать из PATH
  try { execSync('git --version', { stdio: 'ignore' }); return 'git'; } catch(e) {}

  // 2. Стандартные пути Git for Windows
  const candidates = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.USERPROFILE  || '', 'AppData', 'Local', 'Programs', 'Git', 'cmd', 'git.exe'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`Git найден: ${p}`);
      return `"${p}"`;
    }
  }

  console.error([
    'Git не найден!',
    'Установите Git for Windows: https://git-scm.com/download/win',
    'Или добавьте git в PATH и перезапустите VS Code.',
  ].join('\n'));
  process.exit(1);
}

// ── Bump version ──────────────────────────────────────────────────────────────
const type = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Использование: node scripts/bump.js [patch|minor|major]');
  process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const [maj, min, pat] = pkg.version.split('.').map(Number);
const next = type === 'major' ? `${maj+1}.0.0`
           : type === 'minor' ? `${maj}.${min+1}.0`
           :                    `${maj}.${min}.${pat+1}`;

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`Версия: ${pkg.version.replace(next, '')}${next.split('.').slice(0,-1).join('.')}... → v${next}`);

// ── Git: commit + tag + push ──────────────────────────────────────────────────
const git = findGit();
const run = cmd => execSync(cmd, { stdio: 'inherit' });

try {
  run(`${git} add package.json`);
  run(`${git} commit -m "chore: release v${next}"`);
  run(`${git} tag v${next}`);
  run(`${git} push`);
  run(`${git} push --tags`);
  console.log(`\n✓ Готово! Тег v${next} запушен — GitHub Actions запустит сборку.`);
} catch(e) {
  console.error('\nОшибка git:', e.message);
  process.exit(1);
}
