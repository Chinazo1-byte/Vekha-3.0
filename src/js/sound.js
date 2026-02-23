// ══════════════════════════════════════════════════════════════════════════════
//  ЗВУКОВОЙ ДВИЖОК «ВЕХА»
//  Все звуки кешируются, громкость и включение управляется глобально
// ══════════════════════════════════════════════════════════════════════════════

const Sound = (() => {
  const cache  = {};
  let enabled  = true;
  let volume   = 0.7;

  // Загружаем настройки из localStorage
  try {
    const s = JSON.parse(localStorage.getItem('vekha_sound') || '{}');
    if (s.enabled !== undefined) enabled = s.enabled;
    if (s.volume  !== undefined) volume  = s.volume;
  } catch(e) {}

  function save() {
    try { localStorage.setItem('vekha_sound', JSON.stringify({ enabled, volume })); } catch(e) {}
  }

  function get(name) {
    if (!cache[name]) {
      const a = new Audio(`assets/sounds/${name}.wav`);
      a.preload = 'auto';
      cache[name] = a;
    }
    return cache[name];
  }

  function play(name, vol) {
    if (!enabled) return;
    try {
      const a = get(name).cloneNode();
      a.volume = Math.min(1, (vol ?? volume));
      a.play().catch(() => {});
    } catch(e) {}
  }

  // Предзагружаем все звуки при старте
  ['click','success','error','match','win','chain_win','next','start','timer_tick','timer_warn']
    .forEach(n => get(n));

  return {
    // Воспроизведение
    click()      { play('click',      0.5); },
    success()    { play('success',    0.8); },
    error()      { play('error',      0.7); },
    match()      { play('match',      0.8); },
    win()        { play('win',        0.9); },
    chainWin()   { play('chain_win',  1.0); },
    next()       { play('next',       0.5); },
    start()      { play('start',      0.7); },
    timerTick()  { play('timer_tick', 0.4); },
    timerWarn()  { play('timer_warn', 0.8); },

    // Настройки
    setEnabled(v) { enabled = v; save(); },
    setVolume(v)  { volume = v;  save(); },
    isEnabled()   { return enabled; },
    getVolume()   { return volume; },
  };
})();
