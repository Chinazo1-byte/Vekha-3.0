// ══════════════════════════════════════════════════════════════════════════════
//  ОПРЕДЕЛЕНИЯ МЕТОДИК И АЛГОРИТМЫ ПОДСЧЁТА
//  Источник: Люшер, Лурия, Пьерон-Рузер, Керн-Йерасек, Щур, Иванова
// ══════════════════════════════════════════════════════════════════════════════

// ── Цвета теста Люшера ────────────────────────────────────────────────────────
const LUSCHER_COLORS = [
  { id: 0, hex: '#808080', name: 'Серый'      },
  { id: 1, hex: '#3B5FBB', name: 'Синий'      },
  { id: 2, hex: '#3A8B3D', name: 'Зелёный'    },
  { id: 3, hex: '#D12B2B', name: 'Красный'    },
  { id: 4, hex: '#F5C800', name: 'Жёлтый'     },
  { id: 5, hex: '#B05A2A', name: 'Фиолетовый' },  // Люшер использует фиолетовый
  { id: 6, hex: '#7B4B2A', name: 'Коричневый' },
  { id: 7, hex: '#1A1A1A', name: 'Чёрный'     },
];

// ── Регистр методик ───────────────────────────────────────────────────────────
const DIAG_METHODS = {

  // ════════════════════════════════════════════════════════════════════════════
  // 1. ТЕСТ ЛЮШЕРА (8-цветовой)
  // ════════════════════════════════════════════════════════════════════════════
  luscher: {
    id:          'luscher',
    name:        'Тест Люшера (8-цветовой)',
    shortName:   'Люшер',
    icon:        '🎨',
    description: 'Проективная методика исследования эмоционального состояния. Два выбора ряда из 8 цветов.',
    fill_by:     'teacher',
    category:    'emotional',
    ageRange:    '5+',

    // Схема входных данных
    inputSchema: {
      row1: 'number[8]',  // порядок выбора в 1-м ряду (индексы цветов 0-7)
      row2: 'number[8]',  // порядок выбора во 2-м ряду
    },

    // Алгоритм подсчёта
    score(data) {
      const { row1, row2 } = data;
      if (!row1?.length || !row2?.length) return null;

      // Позиция цвета в ряду (1-8, где 1 = первый выбор = предпочитаемый)
      const pos1 = {};  // colorId -> position (1-8)
      const pos2 = {};
      row1.forEach((cid, i) => { pos1[cid] = i + 1; });
      row2.forEach((cid, i) => { pos2[cid] = i + 1; });

      // Среднее положение каждого цвета по двум выборам
      const avgPos = {};
      LUSCHER_COLORS.forEach(c => {
        avgPos[c.id] = ((pos1[c.id] || 8) + (pos2[c.id] || 8)) / 2;
      });

      // Вегетативный коэффициент (ВК) по Шипошу
      // ВК = (18 - pos_blue - pos_green) / (18 - pos_red - pos_yellow)
      const blue   = avgPos[1]; // синий
      const green  = avgPos[2]; // зелёный
      const red    = avgPos[3]; // красный
      const yellow = avgPos[4]; // жёлтый

      const vkNum = 18 - blue - green;
      const vkDen = 18 - red  - yellow;
      const vk    = vkDen !== 0 ? +(vkNum / vkDen).toFixed(2) : null;

      // Маркеры тревоги: цвета 0 (серый), 6 (коричн), 7 (чёрный) на позициях 1-3
      const anxietyColors = [0, 6, 7];
      const anxietyMarkers = anxietyColors.filter(cid =>
        (avgPos[cid] || 9) <= 3
      ).map(cid => LUSCHER_COLORS[cid].name);

      // Маркеры конфликта: цвета 1, 2, 3, 4 на позициях 6-8 (вытеснены)
      const basicColors = [1, 2, 3, 4];
      const conflictMarkers = basicColors.filter(cid =>
        (avgPos[cid] || 1) >= 6
      ).map(cid => LUSCHER_COLORS[cid].name);

      // Ведущий цвет (1-я позиция по среднему)
      const leading = LUSCHER_COLORS.reduce((a, b) => avgPos[a.id] < avgPos[b.id] ? a : b);
      const rejected = LUSCHER_COLORS.reduce((a, b) => avgPos[a.id] > avgPos[b.id] ? a : b);

      return { avgPos, vk, anxietyMarkers, conflictMarkers, leading, rejected, pos1, pos2 };
    },

    // Интерпретация
    interpret(scores) {
      if (!scores) return { level: 'unknown', text: 'Недостаточно данных' };
      const { vk, anxietyMarkers, conflictMarkers, leading, rejected } = scores;

      const markers = [];
      const risks   = [];

      // ВК
      let vkText = '', vkLevel = 'norm';
      if (vk !== null) {
        if      (vk > 1.5) { vkText = `ВК = ${vk} — выраженное возбуждение, перегрузка, стресс`; vkLevel = 'high'; }
        else if (vk > 1.0) { vkText = `ВК = ${vk} — умеренное возбуждение, активная позиция`; }
        else if (vk > 0.5) { vkText = `ВК = ${vk} — норма, уравновешенное состояние`; }
        else               { vkText = `ВК = ${vk} — парасимпатикотония, истощение или заторможенность`; vkLevel = 'low'; }
      }

      if (anxietyMarkers.length)  risks.push(`⚠️ Маркеры тревоги: ${anxietyMarkers.join(', ')} в начале ряда`);
      if (conflictMarkers.length) risks.push(`⚠️ Вытесненные потребности: ${conflictMarkers.join(', ')} в конце ряда`);

      markers.push(`Ведущий цвет: ${leading.name} — ${DiagScoringText.luscherColor(leading.id)}`);
      markers.push(`Отвергаемый цвет: ${rejected.name} — ${DiagScoringText.luscherColor(rejected.id, true)}`);

      const level = risks.length >= 2 ? 'risk' : risks.length === 1 ? 'attention' : 'norm';

      return { level, vkText, vkLevel, markers, risks };
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 2. МЕТОДИКА «10 СЛОВ» (А.Р. ЛУРИЯ)
  // ════════════════════════════════════════════════════════════════════════════
  luria10: {
    id:          'luria10',
    name:        '10 слов (Лурия)',
    shortName:   '10 слов',
    icon:        '🧠',
    description: 'Исследование слухоречевой памяти. 5 немедленных воспроизведений + 1 отсроченное (через 30–60 мин).',
    fill_by:     'teacher',
    category:    'memory',
    ageRange:    '6+',

    inputSchema: {
      attempts: 'number[6]', // n[0]-n[4] немедленные, n[5] отсроченное
    },

    score(data) {
      const { attempts } = data;
      if (!attempts || attempts.length < 5) return null;

      const immediate = attempts.slice(0, 5);
      const delayed   = attempts[5] ?? null;

      // Тип кривой памяти
      let curveType = 'ascending'; // восходящая (норма)
      let declineCount = 0;

      for (let i = 1; i < immediate.length; i++) {
        if (immediate[i] < immediate[i-1]) declineCount++;
      }

      // Проверка инертности: разброс <= 1 на протяжении 3+ попыток
      const mid = immediate.slice(1, 4);
      const spread = Math.max(...mid) - Math.min(...mid);
      const isInert = spread <= 1 && mid[0] <= 7;

      if (declineCount >= 2)      curveType = 'asthenic';   // астенический
      else if (isInert)           curveType = 'inert';      // инертный
      else if (declineCount === 1) curveType = 'unstable';  // неустойчивый

      // Пик запоминания
      const peak = Math.max(...immediate);
      // Итог 5-й попытки
      const final5 = immediate[4];
      // Среднее по 5 попыткам
      const avg = +(immediate.reduce((a,b)=>a+b,0)/5).toFixed(1);

      // Долговременная память
      let delayedStatus = null;
      if (delayed !== null) {
        delayedStatus = delayed >= 7 ? 'ok' : delayed >= 5 ? 'reduced' : 'low';
      }

      return { immediate, delayed, curveType, peak, final5, avg, delayedStatus };
    },

    interpret(scores) {
      if (!scores) return { level: 'unknown', text: 'Недостаточно данных' };
      const { curveType, peak, avg, delayed, delayedStatus } = scores;

      const curveLabels = {
        ascending: 'Восходящая (норма) — постепенное улучшение',
        asthenic:  'Астенический тип — нарастающее истощение внимания',
        inert:     'Инертный тип — ригидность, тугоподвижность',
        unstable:  'Неустойчивая — нестабильность внимания и памяти',
      };

      const risks = [];
      const markers = [];

      markers.push(`Пик запоминания: ${peak}/10 слов`);
      markers.push(`Среднее: ${avg}/10`);
      markers.push(`Кривая памяти: ${curveLabels[curveType]}`);

      if (curveType === 'asthenic') risks.push('⚠️ Астенический тип — возможно истощение ЦНС, переутомление');
      if (curveType === 'inert')    risks.push('⚠️ Инертный тип — проверить нейродинамику');
      if (peak < 6)                 risks.push('⚠️ Объём кратковременной памяти снижен (пик < 6)');

      if (delayedStatus === 'reduced') markers.push(`Отсроченное воспроизведение: ${delayed}/10 — умеренное снижение долговременной памяти`);
      if (delayedStatus === 'low')     risks.push(`⚠️ Долговременная память снижена: отсроченно воспроизведено ${delayed}/10 (норма ≥ 7)`);
      else if (delayedStatus === 'ok') markers.push(`Отсроченное воспроизведение: ${delayed}/10 — норма`);

      const level = risks.length >= 2 ? 'risk' : risks.length === 1 ? 'attention' : 'norm';
      return { level, markers, risks };
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 3. «ЧЕТВЁРТЫЙ ЛИШНИЙ»
  // ════════════════════════════════════════════════════════════════════════════
  fourthOdd: {
    id:          'fourthOdd',
    name:        'Четвёртый лишний',
    shortName:   '4-й лишний',
    icon:        '🔲',
    description: 'Исследование уровня обобщения и классификации. Набор карточек с 4 предметами.',
    fill_by:     'teacher',
    category:    'thinking',
    ageRange:    '4+',

    inputSchema: {
      items: '{ chosen: number, score: 0|1|2, explanation: string }[]',
      // score: 0 = случайный/нет объяснения, 1 = функциональный, 2 = категориальный
    },

    score(data) {
      const { items } = data;
      if (!items?.length) return null;

      const scores  = items.map(it => it.score ?? 0);
      const total   = scores.reduce((a,b) => a+b, 0);
      const avg     = +(total / items.length).toFixed(2);
      const cat2    = scores.filter(s => s === 2).length; // категориальные
      const func1   = scores.filter(s => s === 1).length; // функциональные
      const zero0   = scores.filter(s => s === 0).length; // ситуативные/отказ

      let thinkingType;
      if      (avg > 1.5) thinkingType = 'categorical';
      else if (avg >= 1.0) thinkingType = 'functional';
      else                 thinkingType = 'situational';

      return { items, avg, total, cat2, func1, zero0, thinkingType, count: items.length };
    },

    interpret(scores) {
      if (!scores) return { level: 'unknown', text: 'Недостаточно данных' };
      const { avg, thinkingType, cat2, func1, zero0, count } = scores;

      const typeLabels = {
        categorical: 'Категориальное мышление — норма, высокий уровень обобщения',
        functional:  'Функциональное мышление — средний уровень, конкретно-функциональный подход',
        situational: 'Ситуативное мышление — риск задержки развития',
      };

      const risks   = [];
      const markers = [];

      markers.push(`Средний балл: ${avg} из 2.0 (${count} заданий)`);
      markers.push(`Категориальных ответов: ${cat2}, функциональных: ${func1}, ситуативных: ${zero0}`);
      markers.push(`Тип мышления: ${typeLabels[thinkingType]}`);

      if (thinkingType === 'situational') {
        risks.push('⚠️ Ситуативный тип — возможна ЗПР или недостаточность обобщения');
        risks.push('Рекомендуется дополнительное обследование: Матрицы Равена, Кубики Коса');
      }
      if (zero0 >= count * 0.5) risks.push('⚠️ Более половины ответов без объяснения или случайные');

      const level = thinkingType === 'situational' ? 'risk'
                  : thinkingType === 'functional'   ? 'attention' : 'norm';

      return { level, markers, risks };
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 4. ПРОБА ПЬЕРОНА–РУЗЕРА
  // ════════════════════════════════════════════════════════════════════════════
  pierronRoser: {
    id:          'pierronRoser',
    name:        'Проба Пьерона–Рузера',
    shortName:   'Пьерон–Рузер',
    icon:        '⬛',
    description: 'Исследование концентрации и устойчивости внимания. Заполнение фигур по образцу.',
    fill_by:     'teacher',
    category:    'attention',
    ageRange:    '4+',

    inputSchema: {
      total:    'number',   // всего фигур обработано
      errors:   'number',   // ошибки (пропуски + неверные знаки)
      time_min: 'number',   // время в минутах (1 или 3)
    },

    score(data) {
      const { total = 0, errors = 0, time_min = 1 } = data;

      // Коэффициент концентрации внимания
      // Формула Уиппла: K = ((total - errors) / total)² * 100 (при total > 0)
      const correct   = Math.max(0, total - errors);
      const accuracy  = total > 0 ? +(correct / total).toFixed(3) : 0;
      const kConc     = total > 0 ? +Math.pow(accuracy, 2).toFixed(2) : 0;

      // Темп (фигур в минуту)
      const pace = +(total / time_min).toFixed(1);

      // Нормативы (для 1 мин, дети 5-8 лет):
      // Высокий: total >= 20, errors <= 2
      // Средний: total 10-19, errors <= 5
      // Низкий: total < 10 или errors > 5
      let level;
      const errRate = total > 0 ? errors / total : 1;

      if      (total >= 20 && errors <= 2)               level = 'high';
      else if (total >= 10 && errRate <= 0.25)            level = 'medium';
      else if (total < 10  && errors === 0)               level = 'slow';     // медлительность
      else if (total >= 15 && errors > 5)                 level = 'impulsive'; // импульсивность
      else                                                level = 'low';

      return { total, errors, correct, accuracy, kConc, pace, level };
    },

    interpret(scores) {
      if (!scores) return { level: 'unknown', text: 'Недостаточно данных' };
      const { total, errors, accuracy, kConc, pace, level } = scores;

      const markers = [];
      const risks   = [];

      markers.push(`Обработано: ${total} фигур, ошибок: ${errors}`);
      markers.push(`Точность: ${Math.round(accuracy*100)}%`);
      markers.push(`Коэффициент концентрации: ${kConc}`);
      markers.push(`Темп: ${pace} фигур/мин`);

      const levelLabels = {
        high:      '✅ Высокий уровень концентрации и устойчивости внимания',
        medium:    'Средний уровень — норма для возраста',
        slow:      '⚠️ Медлительность — низкий темп при хорошей точности',
        impulsive: '⚠️ Импульсивность — высокий темп при большом числе ошибок',
        low:       '⚠️ Низкий уровень концентрации внимания',
      };

      markers.push(levelLabels[level]);

      if (level === 'slow')     risks.push('⚠️ Медлительность: темп значительно ниже нормы. Проверить нейродинамику.');
      if (level === 'impulsive') risks.push('⚠️ Импульсивность: много ошибок при высоком темпе. СДВГ-маркер.');
      if (level === 'low')      risks.push('⚠️ Концентрация снижена. Рекомендуется дополнительная диагностика.');

      const resultLevel = ['slow','impulsive','low'].includes(level) ? (level==='low'?'risk':'attention') : 'norm';
      return { level: resultLevel, markers, risks };
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 5. ТЕСТ «ЛЕСЕНКА» (В.Г. ЩУР)
  // ════════════════════════════════════════════════════════════════════════════
  ladder: {
    id:          'ladder',
    name:        'Лесенка (В.Г. Щур)',
    shortName:   'Лесенка',
    icon:        '🪜',
    description: 'Методика изучения самооценки. Ребёнок ставит себя и значимых людей на ступеньки (1–7).',
    fill_by:     'teacher',
    category:    'selfesteem',
    ageRange:    '5-10',

    inputSchema: {
      selfPos:      'number', // 1-7, куда поставил себя
      momPos:       'number', // 1-7, куда поставила мама (по мнению ребёнка)
      age:          'number', // возраст ребёнка
    },

    score(data) {
      const { selfPos, momPos, age } = data;
      if (!selfPos) return null;

      // Тип самооценки
      let selfEstType;
      if      (selfPos <= 2)                    selfEstType = 'veryLow';
      else if (selfPos <= 3)                    selfEstType = 'low';
      else if (selfPos === 4)                   selfEstType = 'adequate';
      else if (selfPos <= 5 && age && age <= 7) selfEstType = 'high';    // до 7 лет норма
      else if (selfPos <= 5)                    selfEstType = 'adequate';
      else if (selfPos <= 6)                    selfEstType = 'high';
      else                                      selfEstType = 'veryHigh';

      // Отношение с мамой
      let momRelation = null;
      if (momPos) {
        if      (momPos < selfPos)     momRelation = 'conflict';    // мама оценивает ниже
        else if (momPos === selfPos)   momRelation = 'congruent';   // совпадает
        else if (momPos - selfPos > 2) momRelation = 'overprotect'; // мама сильно выше
        else                           momRelation = 'supportive';
      }

      return { selfPos, momPos, selfEstType, momRelation, age };
    },

    interpret(scores) {
      if (!scores) return { level: 'unknown', text: 'Недостаточно данных' };
      const { selfPos, momPos, selfEstType, momRelation } = scores;

      const typeLabels = {
        veryLow:   '⚠️ Резко заниженная самооценка (ступень 1–2) — риск депрессии, тревожности',
        low:       '⚠️ Заниженная самооценка (ступень 3) — неуверенность в себе',
        adequate:  '✅ Адекватная самооценка (ступень 4–5) — норма',
        high:      'Высокая самооценка — норма для дошкольников',
        veryHigh:  '⚠️ Завышенная самооценка (ступень 7) у ребёнка старше 7 лет',
      };

      const momLabels = {
        conflict:    '⚠️ Конфликт: ребёнок считает, что мама оценивает его ниже, чем он себя',
        congruent:   'Оценка мамы совпадает с самооценкой',
        overprotect: '⚠️ Ребёнок считает, что мама оценивает его очень высоко (гиперопека?)',
        supportive:  '✅ Мама оценивает ребёнка выше — поддерживающая среда',
      };

      const markers = [`Ступенька ребёнка: ${selfPos}`];
      if (momPos) markers.push(`Ступенька мамы (по мнению ребёнка): ${momPos}`);
      markers.push(typeLabels[selfEstType]);
      if (momRelation) markers.push(momLabels[momRelation]);

      const risks = [];
      if (['veryLow','low'].includes(selfEstType)) risks.push('⚠️ Низкая самооценка — рекомендуется коррекция');
      if (selfEstType === 'veryHigh' && scores.age > 7) risks.push('⚠️ Завышенная самооценка у ребёнка > 7 лет');
      if (momRelation === 'conflict') risks.push('⚠️ Конфликт в детско-родительских отношениях');

      const level = risks.length >= 2 ? 'risk' : risks.length === 1 ? 'attention' : 'norm';
      return { level, markers, risks };
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 6. ТЕСТ КЕРНА–ЙЕРАСЕКА
  // ════════════════════════════════════════════════════════════════════════════
  kernYerasek: {
    id:          'kernYerasek',
    name:        'Тест Керна–Йерасека',
    shortName:   'Керн–Йерасек',
    icon:        '✏️',
    description: 'Готовность к школе. 3 субтеста: рисунок человека, копирование фраз, копирование точек.',
    fill_by:     'teacher',
    category:    'schoolReadiness',
    ageRange:    '5-7',

    inputSchema: {
      sub1: 'number', // рисунок человека (1-5, где 1 = отлично)
      sub2: 'number', // копирование фраз (1-5)
      sub3: 'number', // копирование точек (1-5)
    },

    score(data) {
      const { sub1, sub2, sub3 } = data;
      if (!sub1 || !sub2 || !sub3) return null;

      const total = sub1 + sub2 + sub3;

      let readiness;
      if      (total <= 5)  readiness = 'high';    // 3-5: готов
      else if (total <= 9)  readiness = 'medium';  // 6-9: зрелость в норме
      else                  readiness = 'low';     // 10-15: не готов

      return { sub1, sub2, sub3, total, readiness };
    },

    interpret(scores) {
      if (!scores) return { level: 'unknown', text: 'Недостаточно данных' };
      const { sub1, sub2, sub3, total, readiness } = scores;

      const subLabels = ['Рисунок человека','Копирование фраз','Срисовывание точек'];
      const subScores = [sub1, sub2, sub3];

      const readLabels = {
        high:   '✅ Готов к школе (сумма 3–5)',
        medium: 'Средняя зрелость (сумма 6–9) — норма',
        low:    '⚠️ Не готов к школе (сумма 10–15) — риск ОВЗ',
      };

      const markers = [
        ...subLabels.map((l, i) => `${l}: ${subScores[i]} балл${subScores[i]===1?'':'а'}`),
        `Итого: ${total} / 15`,
        readLabels[readiness],
      ];

      const risks = [];
      if (readiness === 'low')    risks.push('⚠️ Функциональная незрелость. Рекомендуется логопед, нейропсихолог.');
      if (sub1 >= 4)              risks.push('⚠️ Рисунок человека (суб. 1): значительные трудности');
      if (sub2 >= 4)              risks.push('⚠️ Копирование фраз (суб. 2): трудности символических операций');
      if (sub3 >= 4)              risks.push('⚠️ Срисовывание точек (суб. 3): нарушение пространственного восприятия');

      const level = readiness === 'low' ? 'risk' : readiness === 'medium' ? 'norm' : 'norm';
      return { level, markers, risks };
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 7. ТЕСТ ТРЕВОЖНОСТИ ФИЛЛИПСА (школьная тревожность, 58 вопросов)
// ══════════════════════════════════════════════════════════════════════════════

const PHILLIPS_QUESTIONS = [
  'Трудно ли тебе думать о том же, о чём думают другие?',
  'Беспокоишься ли ты, что не можешь выполнить задание?',
  'Волнуешься ли ты, когда учитель говорит, что собирается посмотреть, как ты работаешь?',
  'Трудно ли тебе учиться так же, как другим детям?',
  'Беспокоит ли тебя мысль, что другие дети смеются над тобой, если ты делаешь ошибки?',
  'Беспокоит ли тебя то, что ты не можешь дать правильного ответа, когда тебя вызывают?',
  'Волнуешься ли ты, когда выполняешь задание, правильно ли ты всё делаешь?',
  'Бывает ли так, что ты боишься высказываться на уроке, потому что боишься сделать глупую ошибку?',
  'Бьётся ли твоё сердце сильно, когда учитель говорит, что собирается проверить твои знания?',
  'Смеются ли над тобой, когда ты делаешь ошибки в своей работе?',
  'Беспокоит ли тебя то, что ты хуже других справляешься с заданием?',
  'Волнуешься ли ты, когда остаёшься один на один с учителем?',
  'Беспокоит ли тебя то, что ты не получишь хорошую отметку, хотя и стараешься?',
  'Боишься ли ты, что тебя накажут за плохую отметку?',
  'Смеются ли над тобой, когда у тебя что-то не выходит?',
  'Бывает ли так, что одноклассники тебе не помогают, когда ты не справляешься с заданием?',
  'Волнуешься ли ты перед контрольной работой?',
  'Трудно ли тебе отвечать перед всем классом?',
  'Боишься ли ты идти в школу?',
  'Переживаешь ли ты из-за домашних заданий?',
  'Волнуешься ли ты, когда учитель даёт самостоятельную работу?',
  'Бывает ли, что ты отказываешься идти к доске, потому что боишься ошибиться?',
  'Боишься ли ты получить плохую отметку?',
  'Беспокоит ли тебя думать о своих ошибках?',
  'Бывает ли, что ты стараешься избежать ответа у доски?',
  'Вынужден ли ты сдерживаться, чтобы не заплакать?',
  'Трудно ли тебе работать на контрольной работе?',
  'Беспокоит ли тебя мнение учителя о тебе?',
  'Боишься ли ты ошибиться при выполнении задания?',
  'Беспокоит ли тебя то, что ты не успеваешь выполнить задание в срок?',
  'Бываешь ли ты недоволен, когда учитель делает тебе замечание?',
  'Трудно ли тебе концентрироваться на уроке?',
  'Волнуешься ли ты перед ответом у доски?',
  'Боишься ли ты, что учитель будет недоволен тобой?',
  'Беспокоит ли тебя мысль, что другие ученики лучше тебя?',
  'Страшно ли тебе идти к доске?',
  'Бывает ли, что ты боишься быть смешным в глазах других?',
  'Беспокоит ли тебя то, что всё получается хуже, чем у других?',
  'Боишься ли ты, что тебя накажут родители за плохую отметку?',
  'Трудно ли тебе отвечать на уроке?',
  'Беспокоит ли тебя то, что ты можешь отстать от одноклассников?',
  'Волнуешься ли ты за своё будущее?',
  'Боишься ли ты отвечать перед классом?',
  'Смеются ли одноклассники над тобой?',
  'Беспокоит ли тебя то, что тебя не любят одноклассники?',
  'Бывает ли, что ты не можешь сосредоточиться на уроке?',
  'Боишься ли ты, что тебя отругают за плохую работу?',
  'Страшно ли тебе отвечать на вопросы?',
  'Беспокоит ли тебя то, что ты неправильно понимаешь объяснение?',
  'Волнуешься ли ты, что тебя вызовут отвечать?',
  'Бывает ли, что одноклассники смеются над твоими ответами?',
  'Беспокоит ли тебя расписание уроков?',
  'Боишься ли ты, что учитель поставит тебе двойку?',
  'Волнуешься ли ты, когда учитель говорит, что будет проверочная?',
  'Трудно ли тебе делать домашнее задание?',
  'Бывает ли, что ты не хочешь идти в школу из-за страха?',
  'Беспокоит ли тебя то, что учитель относится к тебе хуже, чем к другим?',
  'Волнуешься ли ты перед ответственным делом в школе?',
];

// Ключи: 1=Да тревожно, 0=Нет не тревожно (упрощённая версия без инверсий)
const PHILLIPS_KEY = Array(58).fill(1); // все вопросы прямые (ответ "Да" = тревога)

const PHILLIPS_FACTORS = {
  general:    { name: 'Общая тревожность',       qs: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57] },
  school:     { name: 'Школьная тревожность',    qs: [0,1,2,4,5,6,8,10,12,14,16,17,19,20,22,24,26,28,30,32,33,36,38,40,42,44,46,48,50,52,54,56] },
  evaluation: { name: 'Страх самовыражения',     qs: [3,7,11,15,18,21,25,29,34,37,41,43,45,47,49,51,53,55,57] },
  teacher:    { name: 'Страх не соответствовать', qs: [2,6,9,13,16,23,27,31,33,35,38,42,46,50,53] },
};

DIAG_METHODS['phillips'] = {
  id:          'phillips',
  name:        'Тест школьной тревожности Филлипса',
  shortName:   'Филлипс',
  icon:        '😰',
  description: 'Диагностика уровня и характера тревожности, связанной со школой. 58 вопросов, ответы Да/Нет.',
  fill_by:     'student',
  category:    'emotional',
  ageRange:    '8–15',

  score(data) {
    const ans = data.answers || [];
    const total = ans.filter(a => a === 1).length;
    const pct   = Math.round(total / 58 * 100);

    const factors = {};
    for (const [key, f] of Object.entries(PHILLIPS_FACTORS)) {
      const factorYes = f.qs.filter(i => ans[i] === 1).length;
      factors[key] = { count: factorYes, pct: Math.round(factorYes / f.qs.length * 100), name: f.name };
    }
    return { total, pct, factors };
  },

  interpret(scores) {
    if (!scores) return { level: 'unknown', markers: [], risks: [] };
    const { pct, factors } = scores;

    const level = pct < 20 ? 'norm' : pct < 45 ? 'attention' : 'risk';

    const levelLabel = { norm: 'Норма', attention: 'Повышенная тревожность', risk: 'Высокая тревожность' };
    const markers = [
      `Общий показатель: ${scores.pct}% положительных ответов (${scores.total} из 58)`,
      ...Object.values(factors).map(f => `${f.name}: ${f.pct}% (${f.count} отм.)`),
    ];
    const risks = [];
    if (pct >= 45) risks.push('⚠️ Требует внимания: высокий уровень школьной тревожности');
    if (factors.teacher?.pct >= 60) risks.push('⚠️ Выраженный страх не соответствовать ожиданиям учителя');
    if (factors.evaluation?.pct >= 60) risks.push('⚠️ Выраженный страх самовыражения в классе');

    return { level, vkText: levelLabel[level], markers, risks };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 8. МОТИВАЦИЯ УЧЕНИЯ ЛУСКАНОВОЙ (10 вопросов, 3 варианта)
// ══════════════════════════════════════════════════════════════════════════════

const LUSKAN_QUESTIONS = [
  {
    text: 'Тебе нравится в школе или не очень?',
    opts: ['не очень', 'нравится', 'не нравится'],
    scores: [1, 3, 0],
  },
  {
    text: 'Утром, когда ты просыпаешься, ты всегда с радостью идёшь в школу или тебе часто хочется остаться дома?',
    opts: ['чаще хочется остаться дома', 'бывает по-разному', 'иду с радостью'],
    scores: [0, 1, 3],
  },
  {
    text: 'Если бы учитель сказал, что завтра в школу необязательно приходить всем ученикам, ты пошёл бы в школу или остался дома?',
    opts: ['не знаю', 'остался бы дома', 'пошёл бы в школу'],
    scores: [1, 0, 3],
  },
  {
    text: 'Тебе нравится, когда у вас отменяют какие-нибудь уроки?',
    opts: ['не нравится', 'бывает по-разному', 'нравится'],
    scores: [3, 1, 0],
  },
  {
    text: 'Ты хотел бы, чтобы тебе не задавали домашних заданий?',
    opts: ['хотел бы', 'не знаю', 'не хотел бы'],
    scores: [0, 1, 3],
  },
  {
    text: 'Ты хотел бы, чтобы в школе остались одни перемены?',
    opts: ['не знаю', 'не хотел бы', 'хотел бы'],
    scores: [1, 3, 0],
  },
  {
    text: 'Ты часто рассказываешь о школе родителям?',
    opts: ['часто', 'редко', 'не рассказываю'],
    scores: [3, 1, 0],
  },
  {
    text: 'Ты хотел бы, чтобы у тебя был менее строгий учитель?',
    opts: ['точно не знаю', 'хотел бы', 'не хотел бы'],
    scores: [1, 0, 3],
  },
  {
    text: 'У тебя в классе много друзей?',
    opts: ['мало', 'много', 'нет друзей'],
    scores: [1, 3, 0],
  },
  {
    text: 'Тебе нравятся твои одноклассники?',
    opts: ['нравятся', 'не очень', 'не нравятся'],
    scores: [3, 1, 0],
  },
];

DIAG_METHODS['luskan'] = {
  id:          'luskan',
  name:        'Мотивация учения (Лусканова)',
  shortName:   'Лусканова',
  icon:        '🎓',
  description: '10 вопросов для оценки учебной мотивации младших школьников. Определяет один из 5 уровней мотивации.',
  fill_by:     'student',
  category:    'schoolReadiness',
  ageRange:    '6–10',

  score(data) {
    const ans  = data.answers || [];
    const total = ans.reduce((sum, a) => sum + (a ?? 0), 0);
    return { total, answers: ans };
  },

  interpret(scores) {
    if (!scores) return { level: 'unknown', markers: [], risks: [] };
    const { total } = scores;

    let motLevel, motLabel, motDesc;
    if (total >= 25) {
      motLevel = 'norm'; motLabel = 'Уровень 5 — Высокая мотивация';
      motDesc = 'Школа привлекает в первую очередь учебной деятельностью. Познавательный мотив преобладает.';
    } else if (total >= 20) {
      motLevel = 'norm'; motLabel = 'Уровень 4 — Хорошая мотивация';
      motDesc = 'Ребёнок успешно справляется с учебной деятельностью.';
    } else if (total >= 15) {
      motLevel = 'attention'; motLabel = 'Уровень 3 — Положительное отношение к школе';
      motDesc = 'Школа привлекает внеучебными сторонами (общение, перемены, прогулки).';
    } else if (total >= 10) {
      motLevel = 'attention'; motLabel = 'Уровень 2 — Низкая мотивация';
      motDesc = 'Ребёнок неохотно посещает школу, преобладают трудности адаптации.';
    } else {
      motLevel = 'risk'; motLabel = 'Уровень 1 — Негативное отношение к школе';
      motDesc = 'Школьная дезадаптация, серьёзные трудности в учебной деятельности.';
    }

    const risks = [];
    if (motLevel === 'risk')      risks.push('⚠️ Необходима консультация с психологом и педагогом');
    if (motLevel === 'attention') risks.push('⚠️ Рекомендуется дополнительная работа по формированию учебной мотивации');

    return {
      level: motLevel,
      vkText: motLabel,
      markers: [`Сумма баллов: ${total} из 30`, motDesc],
      risks,
    };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 9. СОЦИОМЕТРИЯ (упрощённая — для класса до 30 чел.)
// ══════════════════════════════════════════════════════════════════════════════
DIAG_METHODS['sociometry'] = {
  id:          'sociometry',
  name:        'Социометрия класса',
  shortName:   'Социометрия',
  icon:        '🤝',
  description: 'Исследование межличностных отношений в классе. Педагог вводит имена и выборы каждого ученика.',
  fill_by:     'teacher',
  category:    'emotional',
  ageRange:    '6+',

  score(data) {
    const { pupils, choices } = data; // choices: { pupilIdx: [chosenIdx, ...], ... }
    if (!pupils?.length || !choices) return null;

    const n = pupils.length;
    // Число полученных выборов
    const received = Array(n).fill(0);
    for (const arr of Object.values(choices)) {
      for (const ci of arr) {
        if (ci >= 0 && ci < n) received[ci]++;
      }
    }
    // Число сделанных выборов
    const given = Array(n).fill(0);
    for (const [pi, arr] of Object.entries(choices)) {
      given[parseInt(pi)] = arr.length;
    }

    // Социометрический статус
    const maxChoices = Math.max(...received, 1);
    const statuses = received.map(r => {
      const pct = r / (n - 1);
      if (pct >= 0.5) return 'star';
      if (pct >= 0.2) return 'preferred';
      if (pct === 0)  return 'rejected';
      return 'average';
    });

    return { pupils, received, given, statuses, total: n };
  },

  interpret(scores) {
    if (!scores) return { level: 'unknown', markers: [], risks: [] };
    const { pupils, received, statuses } = scores;
    const stars     = statuses.filter(s => s === 'star').length;
    const rejected  = statuses.filter(s => s === 'rejected').length;
    const pctRej    = Math.round(rejected / pupils.length * 100);

    const level = rejected >= 3 || pctRej >= 30 ? 'risk' : rejected > 0 ? 'attention' : 'norm';

    const markers = [
      `Класс: ${pupils.length} учеников`,
      `«Звёзды» (>50% выборов): ${stars}`,
      `Не получили выборов: ${rejected} (${pctRej}%)`,
    ];

    const risks = [];
    if (pctRej >= 30) risks.push('⚠️ Высокий процент социально изолированных учеников');
    if (rejected > 0) {
      risks.push(`⚠️ Изолированные ученики: ${
        pupils.filter((_,i) => statuses[i] === 'rejected').join(', ')
      }`);
    }

    return { level, markers, risks };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 10. ВАШ — ВИЗУАЛЬНАЯ АНАЛОГОВАЯ ШКАЛА (оперативная диагностика состояния)
// ══════════════════════════════════════════════════════════════════════════════
DIAG_METHODS['vas'] = {
  id:          'vas',
  name:        'ВАШ — Состояние и настроение',
  shortName:   'ВАШ',
  icon:        '🌡️',
  description: 'Быстрая оценка актуального психоэмоционального состояния. 5 шкал по 10 баллов.',
  fill_by:     'student',
  category:    'emotional',
  ageRange:    '7+',

  score(data) {
    const sliders = data.sliders || {};
    return { sliders };
  },

  interpret(scores) {
    if (!scores) return { level: 'unknown', markers: [], risks: [] };
    const s = scores.sliders;
    const vals = Object.values(s).filter(v => typeof v === 'number');
    const avg  = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0) / vals.length * 10) / 10 : null;

    const SCALES = [
      { key: 'mood',      name: 'Настроение',  low: 'плохое', high: 'отличное' },
      { key: 'energy',    name: 'Энергия',     low: 'нет сил', high: 'полон сил' },
      { key: 'anxiety',   name: 'Тревога',     low: 'нет тревоги', high: 'очень тревожно', reverse: true },
      { key: 'interest',  name: 'Интерес',     low: 'скучно', high: 'очень интересно' },
      { key: 'comfort',   name: 'Комфорт',     low: 'некомфортно', high: 'комфортно' },
    ];

    const level = avg !== null && avg < 4 ? 'risk' : avg !== null && avg < 6 ? 'attention' : 'norm';

    const markers = SCALES
      .filter(sc => s[sc.key] !== undefined)
      .map(sc => {
        const v = s[sc.key];
        const eff = sc.reverse ? 10 - v : v;
        return `${sc.name}: ${v}/10`;
      });
    if (avg !== null) markers.unshift(`Средний балл благополучия: ${avg}/10`);

    const risks = [];
    if (s.anxiety >= 7) risks.push('⚠️ Высокий уровень тревоги по самооценке');
    if (s.mood    <= 3) risks.push('⚠️ Низкое настроение по самооценке');
    if (s.energy  <= 3) risks.push('⚠️ Выраженное снижение энергии');

    return { level, markers, risks };
  },
};

// ── Текстовые интерпретации значений цветов Люшера ───────────────────────────
const DiagScoringText = {
  luscherColor(id, rejected = false) {
    const meanings = {
      0: rejected ? 'избегание контактов, усталость' : 'стремление к покою, нейтральность',
      1: rejected ? 'отказ от глубины, поверхностность' : 'потребность в спокойствии и привязанности',
      2: rejected ? 'протест, упрямство' : 'стремление к самостоятельности, настойчивость',
      3: rejected ? 'отказ от деятельности, истощение' : 'активность, возбуждение, желание победы',
      4: rejected ? 'разочарование, тревога о будущем' : 'стремление к переменам, оптимизм',
      5: rejected ? 'отрицание мечты, приземлённость' : 'фантазия, интуиция',
      6: rejected ? 'бегство от реальности' : 'физиологический дискомфорт, телесное неблагополучие',
      7: rejected ? 'протест, негативизм' : 'негативизм, ощущение тупика',
    };
    return meanings[id] || '—';
  },
};

// ── Хелперы ───────────────────────────────────────────────────────────────────
function getDiagMethod(id) {
  return Object.values(DIAG_METHODS).find(m => m.id === id) || null;
}

function getAllDiagMethods() {
  return Object.values(DIAG_METHODS);
}
