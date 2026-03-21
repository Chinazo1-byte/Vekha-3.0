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

// ══════════════════════════════════════════════════════════════════════════════
// 11. ЭББИНГАУЗА — Заполнение пропусков в тексте
// ══════════════════════════════════════════════════════════════════════════════
const _EBB_EXPECTED = {
  1:['тучи','облака'], 2:['метель','вьюга','буря','пурга'], 3:['хлопьями','клочьями'],
  4:['зверь','волк'], 5:['зверь','волк','пёс'], 6:['улицы','дороги'],
  7:['трудом','усилием'], 8:['улице','дороге','снегу'], 9:['одета','одетой'],
  10:['мешали'], 11:['пальто','платье','пальтишко'], 12:['платок','шаль','ничего'],
  13:['остановилась','упала','споткнулась'], 14:['искать','нащупывать','разгребать'],
  15:['колени','четвереньки'], 16:['рыть','копать','разгребать','шарить'],
};

DIAG_METHODS['ebbinghaus_fill_blank'] = {
  id: 'ebbinghaus_fill_blank',
  name: 'Методика Эббингауза',
  shortName: 'Эббингауза',
  icon: '✍️',
  description: 'Исследование развития речи и продуктивности ассоциаций. Ребёнок вставляет 16 слов в связный текст.',
  fill_by: 'teacher',
  category: 'thinking',
  ageRange: '7+',

  score(data) {
    const answers = data.answers || {};
    const notes   = data.notes || '';
    let correct = 0;
    const detail = {};
    for (let i = 1; i <= 16; i++) {
      const raw = (answers[i] || '').trim().toLowerCase().replace(/[.,!?;]/g, '');
      const ok  = (_EBB_EXPECTED[i] || []).some(e => e.replace(/[.,]/g,'') === raw);
      if (ok) correct++;
      detail[i] = { answer: answers[i] || '', ok };
    }
    return { correct, total: 16, detail, notes };
  },

  interpret(scores) {
    if (!scores) return { level:'none', markers:[], risks:[] };
    const { correct } = scores;
    const pct = correct / 16;
    const level = pct >= 0.75 ? 'norm' : pct >= 0.5 ? 'attention' : 'risk';
    const markers = [
      `Точных ответов: ${correct} из 16 (${Math.round(pct*100)}%)`,
      pct >= 0.75 ? 'Высокий уровень — речевые ассоциации богатые и точные'
        : pct >= 0.5 ? 'Средний уровень — ассоциации в целом адекватны контексту'
        : 'Низкий уровень — выраженные затруднения с подбором слов по смыслу',
    ];
    const risks = correct < 8 ? ['⚠️ Менее 50% точных ответов — возможны нарушения речевого развития и понимания текста'] : [];
    return { level, markers, risks };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 12. САН — Самочувствие, Активность, Настроение
// ══════════════════════════════════════════════════════════════════════════════
const _SAN_ITEMS = [
  {id:1,  l:'Самочувствие хорошее',  r:'Самочувствие плохое',   s:'С'},
  {id:2,  l:'Чувствую себя сильным', r:'Чувствую себя слабым',  s:'С'},
  {id:3,  l:'Пассивный',             r:'Активный',              s:'А', rev:1},
  {id:4,  l:'Малоподвижный',         r:'Подвижный',             s:'А', rev:1},
  {id:5,  l:'Весёлый',               r:'Грустный',              s:'Н'},
  {id:6,  l:'Хорошее настроение',    r:'Плохое настроение',     s:'Н'},
  {id:7,  l:'Работоспособный',       r:'Разбитый',              s:'С'},
  {id:8,  l:'Полный сил',            r:'Обессиленный',          s:'С'},
  {id:9,  l:'Медлительный',          r:'Быстрый',               s:'А', rev:1},
  {id:10, l:'Бездеятельный',         r:'Деятельный',            s:'А', rev:1},
  {id:11, l:'Счастливый',            r:'Несчастный',            s:'Н'},
  {id:12, l:'Жизнерадостный',        r:'Мрачный',               s:'Н'},
  {id:13, l:'Напряжённый',           r:'Расслабленный',         s:'С', rev:1},
  {id:14, l:'Здоровый',              r:'Больной',               s:'С'},
  {id:15, l:'Безучастный',           r:'Увлечённый',            s:'А', rev:1},
  {id:16, l:'Равнодушный',           r:'Взволнованный',         s:'А', rev:1},
  {id:17, l:'Восторженный',          r:'Унылый',                s:'Н'},
  {id:18, l:'Радостный',             r:'Печальный',             s:'Н'},
  {id:19, l:'Отдохнувший',           r:'Усталый',               s:'С'},
  {id:20, l:'Свежий',                r:'Изнурённый',            s:'С'},
  {id:21, l:'Сонливый',              r:'Возбуждённый',          s:'А', rev:1},
  {id:22, l:'Желание отдохнуть',     r:'Желание работать',      s:'А', rev:1},
  {id:23, l:'Спокойный',             r:'Озабоченный',           s:'Н'},
  {id:24, l:'Оптимистичный',         r:'Пессимистичный',        s:'Н'},
  {id:25, l:'Выносливый',            r:'Утомляемый',            s:'С'},
  {id:26, l:'Бодрый',                r:'Вялый',                 s:'С'},
  {id:27, l:'Соображать трудно',     r:'Соображать легко',      s:'А', rev:1},
  {id:28, l:'Рассеянный',            r:'Внимательный',          s:'А', rev:1},
  {id:29, l:'Полный надежд',         r:'Разочарованный',        s:'Н'},
  {id:30, l:'Довольный',             r:'Недовольный',           s:'Н'},
];

DIAG_METHODS['san_wellbeing'] = {
  id: 'san_wellbeing',
  name: 'Методика САН',
  shortName: 'САН',
  icon: '🧘',
  description: 'Оперативная оценка самочувствия, активности и настроения. 30 биполярных пар, 3 шкалы.',
  fill_by: 'student',
  category: 'emotional',
  ageRange: '10+',

  score(data) {
    const ratings = data.ratings || {};
    const byScale = { С:[], А:[], Н:[] };
    _SAN_ITEMS.forEach(item => {
      const pos = ratings[item.id];
      if (pos == null) return;
      // direct: left=positive → leftmost(1)=7 pts → score = 8-pos
      // reversed: right=positive → rightmost(7)=7 pts → score = pos
      const score = item.rev ? pos : (8 - pos);
      byScale[item.s].push(score);
    });
    const mean = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : null;
    return { С: mean(byScale.С), А: mean(byScale.А), Н: mean(byScale.Н), answered: Object.keys(ratings).length };
  },

  interpret(scores) {
    if (!scores) return { level:'none', markers:[], risks:[] };
    const NORMS  = { С:5.4, А:5.0, Н:5.1 };
    const NAMES  = { С:'Самочувствие', А:'Активность', Н:'Настроение' };
    const markers = [], risks = [];
    let lowCount = 0;
    ['С','А','Н'].forEach(k => {
      const v = scores[k];
      if (v == null) return;
      markers.push(`${NAMES[k]}: ${v} (норма ≈ ${NORMS[k]})`);
      if (v < 4.0) { risks.push(`⚠️ ${NAMES[k]} значительно снижена (${v})`); lowCount++; }
      else if (v < NORMS[k] - 0.5) risks.push(`↓ ${NAMES[k]} ниже нормы`);
    });
    const level = lowCount >= 2 ? 'risk' : risks.length ? 'attention' : 'norm';
    return { level, markers, risks };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 13. ОСТ — Опросник структуры темперамента (Русалов, В.М.)
// ══════════════════════════════════════════════════════════════════════════════
const _OST_SUBSCALES = [
  { id:'ER', name:'Предметная эргичность',      max:12, ky:[4,8,15,22,42,50,58,64,96],             kn:[27,83,103],          nh:'Высокая потребность в деятельности, инициативность.', nl:'Пассивность, нежелание напрягаться.' },
  { id:'SR', name:'Социальная эргичность',       max:12, ky:[11,30,57,62,67,78,86],                 kn:[3,34,74,90,105],     nh:'Жажда общения, стремление к лидерству.', nl:'Замкнутость, социальная пассивность.' },
  { id:'PL', name:'Пластичность',                max:12, ky:[20,25,35,38,47,66,71,76,101,104],      kn:[54,59],              nh:'Лёгкость переключения, стремление к разнообразию.', nl:'Склонность к монотонии, консерватизм.' },
  { id:'SP', name:'Социальная пластичность',     max:12, ky:[2,9,18,26,45,68,85,99],               kn:[31,81,87,93],        nh:'Широкий набор форм общения, коммуникативная гибкость.', nl:'Трудность подбора форм взаимодействия.' },
  { id:'T',  name:'Темп',                        max:12, ky:[1,13,19,33,46,49,55,77],               kn:[29,43,70,94],        nh:'Высокий двигательный темп, быстрота реакций.', nl:'Замедленность действий.' },
  { id:'ST', name:'Социальный темп',             max:12, ky:[24,37,39,51,92],                       kn:[5,10,16,56,96,102],  nh:'Быстрота речи, высокая вербальная скорость.', nl:'Речевая медлительность.' },
  { id:'EM', name:'Эмоциональность',             max:12, ky:[14,17,28,40,60,61,69,79,88,91,95,97], kn:[],                   nh:'Тревожность, чувствительность к неудачам.', nl:'Спокойствие, устойчивость к стрессу.' },
  { id:'SE', name:'Социальная эмоциональность',  max:12, ky:[6,7,21,36,41,48,53,63,75,80,84,100],  kn:[],                   nh:'Чувствительность к оценкам окружающих.', nl:'Уверенность в ситуациях общения.' },
  { id:'K',  name:'Контрольная шкала',           max:9,  ky:[32,52,89],                             kn:[12,23,44,65,73,82],  validity_threshold:7, nh:'Протокол недействителен — желание выглядеть лучше.', nl:'Адекватная самооценка.' },
];
const _OST_ITEMS = [
  {id:1,t:'Проворный ли ты человек?'},{id:2,t:'Готов ли ты обычно, не раздумывая, включиться в разговор?'},{id:3,t:'Нравится ли тебе быть одному больше, чем в компании?'},{id:4,t:'Испытываешь ли ты постоянную жажду знаний?'},{id:5,t:'Ты предпочитаешь говорить медленно и неторопливо?'},
  {id:6,t:'Задевают ли тебя замечания других людей?'},{id:7,t:'Трудно ли тебе заснуть из-за того, что ты повздорил с друзьями?'},{id:8,t:'Хочется ли тебе заняться каким-либо ответственным делом в свободное от занятий время?'},{id:9,t:'В разговоре с товарищами твоя речь часто опережает твою мысль?'},{id:10,t:'Раздражает ли тебя быстрая речь собеседника?'},
  {id:11,t:'Трудно ли тебе долго не общаться с людьми?'},{id:12,t:'Ты когда-нибудь опаздывал на урок?'},{id:13,t:'Нравится ли тебе быстро ходить и бегать?'},{id:14,t:'Сильно ли ты переживаешь, когда учитель ставит плохие отметки в дневник?'},{id:15,t:'Легко ли тебе выполнять задание, требующее длительного внимания и сосредоточенности?'},
  {id:16,t:'Утомительно ли тебе быстро говорить?'},{id:17,t:'Часто ли ты испытываешь чувство тревоги, что выучил урок недостаточно глубоко?'},{id:18,t:'Легко ли твои мысли переходят с одной темы на другую во время разговора?'},{id:19,t:'Нравятся ли тебе игры, требующие большой скорости и ловкости?'},{id:20,t:'Склонен ли ты искать новые варианты решения задач?'},
  {id:21,t:'Испытываешь ли чувство беспокойства, что тебя неправильно поняли в разговоре?'},{id:22,t:'Охотно ли ты выполняешь сложное общественное поручение?'},{id:23,t:'Бывает ли, что ты говоришь о вещах, в которых не разбираешься?'},{id:24,t:'Легко ли ты воспринимаешь быструю речь?'},{id:25,t:'Легко ли тебе делать одновременно много дел?'},
  {id:26,t:'Часто ли бывает, что ты сказал что-то своим друзьям, не подумав?'},{id:27,t:'Обычно ты предпочитаешь выполнять поручение, не требующее много энергии?'},{id:28,t:'Сильно ли ты переживаешь, когда обнаруживаешь ошибки в работе?'},{id:29,t:'Любишь ли ты медленную сидячую работу?'},{id:30,t:'Легко ли тебе общаться с людьми?'},
  {id:31,t:'Обычно ты предпочитаешь подумать, взвесить и лишь потом высказываться?'},{id:32,t:'Все твои привычки хороши?'},{id:33,t:'Быстры ли твои движения?'},{id:34,t:'Обычно ты молчишь в обществе малознакомых людей?'},{id:35,t:'Легко ли тебе перейти от игры к выполнению уроков?'},
  {id:36,t:'Глубоко ли ты переживаешь плохое к тебе отношение людей?'},{id:37,t:'Разговорчивый ли ты человек?'},{id:38,t:'Легко ли тебе выполнять поручения, требующие мгновенных реакций?'},{id:39,t:'Ты обычно говоришь свободно, без запинок?'},{id:40,t:'Волнуешься ли ты, что не сможешь выполнить порученное задание?'},
  {id:41,t:'Сильно ли ты расстраиваешься, когда близкие друзья указывают на твои недостатки?'},{id:42,t:'Испытываешь ли ты повышенную тягу к приобретению знаний?'},{id:43,t:'Считаешь ли ты свои движения медленными и неторопливыми?'},{id:44,t:'Бывают ли у тебя мысли, которые ты хотел бы скрыть от других?'},{id:45,t:'Легко ли тебе сходу, без раздумий, задавать вопросы?'},
  {id:46,t:'Доставляют ли тебе удовольствие быстрые движения?'},{id:47,t:'Легко ли тебе переключиться на новое дело?'},{id:48,t:'Стесняешься ли ты в присутствии незнакомых людей?'},{id:49,t:'Быстро ли ты выполняешь данное тебе поручение?'},{id:50,t:'Легко ли тебе выполнять сложные, ответственные дела самостоятельно?'},
  {id:51,t:'Можешь ли ты говорить быстро и неразборчиво?'},{id:52,t:'Если ты обещал что-то сделать, всегда ли ты выполняешь обещание?'},{id:53,t:'Считаешь ли ты, что твои друзья обходятся с тобой хуже, чем следовало бы?'},{id:54,t:'Обычно ты предпочитаешь делать одно дело?'},{id:55,t:'Любишь ли ты быстрые игры?'},
  {id:56,t:'Много ли в твоей речи пауз?'},{id:57,t:'Легко ли тебе внести оживление в большую компанию?'},{id:58,t:'Чувствуешь ли ты себя настолько сильным, что тебя тянет заниматься трудным делом?'},{id:59,t:'Трудно ли тебе переключаться с одного задания на другое?'},{id:60,t:'Бывает ли, что надолго портится настроение из-за плохой оценки?'},
  {id:61,t:'Тяжело ли тебе заснуть из-за того, что не ладятся дела в учёбе?'},{id:62,t:'Любишь ли ты бывать в большой компании?'},{id:63,t:'Волнуешься ли ты, выясняя отношения с друзьями?'},{id:64,t:'Испытываешь ли ты сильную потребность в учёбе?'},{id:65,t:'Злишься ли ты иногда по пустякам?'},
  {id:66,t:'Склонен ли ты делать несколько дел одновременно?'},{id:67,t:'Держишься ли ты свободно в большой компании?'},{id:68,t:'Часто ли ты высказываешь своё первое впечатление, не подумав?'},{id:69,t:'Беспокоит ли тебя чувство неуверенности, когда ты готовишь уроки?'},{id:70,t:'Медленны ли твои движения, когда ты что-либо мастеришь?'},
  {id:71,t:'Легко ли ты переключаешься с одного дела на другое?'},{id:72,t:'Быстро ли ты читаешь вслух?'},{id:73,t:'Ты иногда сплетничаешь?'},{id:74,t:'Молчалив ли ты, находясь в кругу незнакомых людей?'},{id:75,t:'Нуждаешься ли ты в людях, которые бы тебя ободрили в трудную минуту?'},
  {id:76,t:'Охотно ли ты выполняешь множество поручений одновременно?'},{id:77,t:'Любишь ли ты выполнять дела в быстром темпе?'},{id:78,t:'В свободное время тебя тянет пообщаться с людьми?'},{id:79,t:'Бывает ли у тебя бессонница при неудачах в школе?'},{id:80,t:'Долго ли ты переживаешь ссору с товарищами?'},
  {id:81,t:'Долго ли ты готовишься, прежде чем высказать своё мнение?'},{id:82,t:'Есть ли в твоём классе ученики, которые тебе очень не нравятся?'},{id:83,t:'Обычно ты предпочитаешь лёгкую работу?'},{id:84,t:'Сильно ли ты переживаешь после ссоры с друзьями?'},{id:85,t:'Легко ли тебе первому начать разговор в компании?'},
  {id:86,t:'Испытываешь ли ты большое желание к общению с людьми?'},{id:87,t:'Склонен ли ты сначала подумать, а потом говорить?'},{id:88,t:'Часто ли ты волнуешься по поводу своих школьных успехов?'},{id:89,t:'Всегда ли ты платил бы за проезд, если бы не опасался проверок?'},{id:90,t:'Держишься ли ты скованно в компании ребят?'},
  {id:91,t:'Склонен ли ты преувеличивать в воображении неудачи, связанные с учёбой?'},{id:92,t:'Нравится ли тебе быстро говорить?'},{id:93,t:'Легко ли тебе удержаться от высказывания неожиданной мысли?'},{id:94,t:'Обычно ты работаешь неторопливо и медленно?'},{id:95,t:'Переживаешь ли ты из-за малейших неудач в учёбе?'},
  {id:96,t:'Ты предпочитаешь медленный и спокойный разговор?'},{id:97,t:'Сильно ли ты волнуешься из-за ошибок в контрольной работе?'},{id:98,t:'Легко ли тебе выполнять работу, требующую много времени?'},{id:99,t:'Легко ли тебе, недолго думая, обратиться с просьбой к взрослому?'},{id:100,t:'Беспокоит ли тебя чувство неуверенности в себе при общении с другими?'},
  {id:101,t:'Охотно ли ты берёшься за выполнение новых поручений?'},{id:102,t:'Устаёшь ли ты, когда говоришь быстро?'},{id:103,t:'Ты предпочитаешь работать с прохладцей, без особого напряжения?'},{id:104,t:'Легко ли тебе одновременно заниматься в нескольких кружках?'},{id:105,t:'Любишь ли ты подолгу оставаться один?'},
];

DIAG_METHODS['ost_rusalov'] = {
  id: 'ost_rusalov',
  name: 'Опросник структуры темперамента (ОСТ)',
  shortName: 'ОСТ Русалова',
  icon: '🌡',
  description: 'Формально-динамические свойства темперамента. 105 вопросов «Да/Нет», 9 шкал.',
  fill_by: 'student',
  category: 'emotional',
  ageRange: '13+',

  score(data) {
    const answers = data.answers || {};
    const result  = {};
    let valid = true;
    _OST_SUBSCALES.forEach(sub => {
      let score = 0;
      (sub.ky || []).forEach(n => { if (answers[n] === 'yes') score++; });
      (sub.kn || []).forEach(n => { if (answers[n] === 'no')  score++; });
      result[sub.id] = score;
      if (sub.id === 'K' && score >= (sub.validity_threshold || 7)) valid = false;
    });
    return { ...result, valid, answered: Object.keys(answers).length };
  },

  interpret(scores) {
    if (!scores) return { level:'none', markers:[], risks:[] };
    if (!scores.valid) return {
      level: 'risk',
      markers: ['⚠️ Протокол недействителен: контрольная шкала К превышает допустимый порог'],
      risks:   ['Результаты ненадёжны. Рекомендуется повторное проведение в другое время.'],
    };
    const markers = [], risks = [];
    _OST_SUBSCALES.filter(s => s.id !== 'K').forEach(sub => {
      const v     = scores[sub.id];
      const level = v >= 9 ? 'high' : v >= 5 ? 'mid' : 'low';
      const note  = level === 'high' ? sub.nh : level === 'low' ? sub.nl : null;
      const lbl   = level === 'high' ? 'высок.' : level === 'low' ? 'низк.' : 'средн.';
      markers.push(`${sub.name}: ${v}/${sub.max} — ${lbl}`);
      if (note) risks.push(`${sub.name}: ${note}`);
    });
    return { level: risks.length > 4 ? 'attention' : 'norm', markers, risks };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 14. ЦЕННОСТНЫЕ ОРИЕНТАЦИИ (Рокич)
// ══════════════════════════════════════════════════════════════════════════════
const _ROKICH_T = [
  {id:'T1',t:'Активная деятельная жизнь'},{id:'T2',t:'Жизненная мудрость'},{id:'T3',t:'Здоровье'},
  {id:'T4',t:'Интересная работа'},{id:'T5',t:'Красота природы и искусства'},{id:'T6',t:'Любовь'},
  {id:'T7',t:'Материально обеспеченная жизнь'},{id:'T8',t:'Хорошие и верные друзья'},{id:'T9',t:'Общественное признание'},
  {id:'T10',t:'Познание'},{id:'T11',t:'Продуктивная жизнь'},{id:'T12',t:'Развитие'},
  {id:'T13',t:'Развлечения'},{id:'T14',t:'Свобода'},{id:'T15',t:'Счастливая семейная жизнь'},
  {id:'T16',t:'Счастье других'},{id:'T17',t:'Творчество'},{id:'T18',t:'Уверенность в себе'},
];
const _ROKICH_I = [
  {id:'I1',t:'Аккуратность'},{id:'I2',t:'Воспитанность'},{id:'I3',t:'Высокие запросы'},
  {id:'I4',t:'Жизнерадостность'},{id:'I5',t:'Исполнительность'},{id:'I6',t:'Независимость'},
  {id:'I7',t:'Непримиримость к недостаткам'},{id:'I8',t:'Образованность'},{id:'I9',t:'Ответственность'},
  {id:'I10',t:'Рационализм'},{id:'I11',t:'Самоконтроль'},{id:'I12',t:'Смелость в отстаивании мнения'},
  {id:'I13',t:'Твёрдая воля'},{id:'I14',t:'Терпимость'},{id:'I15',t:'Широта взглядов'},
  {id:'I16',t:'Честность'},{id:'I17',t:'Эффективность в делах'},{id:'I18',t:'Чуткость'},
];

DIAG_METHODS['rokich_values'] = {
  id: 'rokich_values',
  name: 'Ценностные ориентации (Рокич)',
  shortName: 'ЦО Рокича',
  icon: '🏆',
  description: 'Ранжирование терминальных и инструментальных ценностей. 4 прогона по 18 позиций.',
  fill_by: 'student',
  category: 'selfesteem',
  ageRange: '12+',

  score(data) {
    const rankMap = arr => { const m = {}; (arr||[]).forEach((id,i) => { m[id]=i+1; }); return m; };
    const deltas  = (actual, ideal) => {
      if (!actual?.length || !ideal?.length) return {};
      const rA = rankMap(actual), rI = rankMap(ideal);
      const d  = {};
      actual.forEach(id => { d[id] = Math.abs((rA[id]||18) - (rI[id]||18)); });
      return d;
    };
    return {
      terminal_actual:       data.terminal_actual || [],
      terminal_ideal:        data.terminal_ideal  || [],
      instrumental_actual:   data.instrumental_actual || [],
      instrumental_ideal:    data.instrumental_ideal  || [],
      terminal_deltas:       deltas(data.terminal_actual, data.terminal_ideal),
      instrumental_deltas:   deltas(data.instrumental_actual, data.instrumental_ideal),
    };
  },

  interpret(scores) {
    if (!scores) return { level:'none', markers:[], risks:[] };
    const tD = Object.values(scores.terminal_deltas     || {});
    const iD = Object.values(scores.instrumental_deltas || {});
    const avgT = tD.length ? tD.reduce((a,b)=>a+b,0)/tD.length : 0;
    const avgI = iD.length ? iD.reduce((a,b)=>a+b,0)/iD.length : 0;
    const tension = (avgT + avgI) / 2;

    // Топ-5 терминальных (идеал)
    const top5T = (scores.terminal_ideal || []).slice(0,5);
    const top5Tnames = top5T.map(id => _ROKICH_T.find(x=>x.id===id)?.t || id);
    const top5I = (scores.instrumental_ideal || []).slice(0,5);
    const top5Inames = top5I.map(id => _ROKICH_I.find(x=>x.id===id)?.t || id);

    const markers = [
      top5Tnames.length ? `Приоритетные ценности-цели: ${top5Tnames.join(', ')}` : '',
      top5Inames.length ? `Приоритетные ценности-средства: ${top5Inames.join(', ')}` : '',
      `Расхождение реал./идеал. (терминальные): ${avgT.toFixed(1)} ранг.ед.`,
      `Расхождение реал./идеал. (инструментальные): ${avgI.toFixed(1)} ранг.ед.`,
    ].filter(Boolean);

    const level  = tension > 7 ? 'risk' : tension > 4 ? 'attention' : 'norm';
    const risks  = tension > 7 ? ['⚠️ Высокое расхождение реального и желаемого — ценностная напряжённость'] : [];
    return { level, markers, risks };
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 15. ЛИЧНОСТНЫЕ ОЖИДАНИЯ РЕБЁНКА В ОБЩЕНИИ СО ВЗРОСЛЫМ
// ══════════════════════════════════════════════════════════════════════════════
DIAG_METHODS['personal_expectations_child'] = {
  id: 'personal_expectations_child',
  name: 'Личностные ожидания ребёнка',
  shortName: 'Ожидания ребёнка',
  icon: '💭',
  description: 'Диагностика ожиданий ребёнка в общении со взрослыми. 4 ситуации, специалист фиксирует ответы.',
  fill_by: 'teacher',
  category: 'emotional',
  ageRange: '4+',

  score(data) {
    return { responses: data.responses || {}, summary: data.summary || '' };
  },

  interpret(scores) {
    const hasSummary = !!(scores?.summary?.trim());
    return {
      level:   hasSummary ? 'norm' : 'none',
      markers: hasSummary ? ['Качественный анализ проведён и зафиксирован'] : ['Заполните поле заключения специалиста'],
      risks:   [],
    };
  },
};
