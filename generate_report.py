#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор PDF-отчёта по ученику.
Вызывается из Electron: python3 generate_report.py <json_path> <output_path>
"""
import sys
import json
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF

# ── Цвета ─────────────────────────────────────────────────────────────────────
C_INDIGO   = colors.HexColor('#4F46E5')
C_INDIGO_L = colors.HexColor('#EEF2FF')
C_GREEN    = colors.HexColor('#059669')
C_GREEN_L  = colors.HexColor('#ECFDF5')
C_AMBER    = colors.HexColor('#D97706')
C_AMBER_L  = colors.HexColor('#FFFBEB')
C_ROSE     = colors.HexColor('#E11D48')
C_ROSE_L   = colors.HexColor('#FFF1F2')
C_TEAL     = colors.HexColor('#0D9488')
C_TEAL_L   = colors.HexColor('#F0FDFA')
C_GREY     = colors.HexColor('#6B7280')
C_GREY_L   = colors.HexColor('#F9FAFB')
C_BORDER   = colors.HexColor('#E5E7EB')
C_TEXT1    = colors.HexColor('#111827')
C_TEXT2    = colors.HexColor('#374151')
C_TEXT3    = colors.HexColor('#9CA3AF')

W, H = A4  # 595 x 842 pt

# ── Шрифт (встроенный Helvetica, поддерживает кириллицу через encoding) ───────
# Используем стандартный шрифт + пробрасываем UTF-8 через Paragraph
def style(name, **kw):
    defaults = dict(fontName='Helvetica', fontSize=10, leading=14,
                    textColor=C_TEXT1, spaceAfter=0, spaceBefore=0)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

S = {
    'title':    style('title',    fontSize=22, leading=28, textColor=C_INDIGO,
                      fontName='Helvetica-Bold', spaceAfter=4),
    'subtitle': style('subtitle', fontSize=13, leading=18, textColor=C_TEXT3),
    'h1':       style('h1',       fontSize=14, leading=20, textColor=C_TEXT1,
                      fontName='Helvetica-Bold', spaceBefore=16, spaceAfter=6),
    'h2':       style('h2',       fontSize=11, leading=15, textColor=C_TEXT2,
                      fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=4),
    'body':     style('body',     fontSize=10, leading=14, textColor=C_TEXT2, spaceAfter=3),
    'small':    style('small',    fontSize=8.5, leading=12, textColor=C_TEXT3),
    'marker':   style('marker',   fontSize=9.5, leading=13, textColor=C_TEXT2,
                      leftIndent=10, spaceAfter=2),
    'risk':     style('risk',     fontSize=9.5, leading=13, textColor=C_ROSE,
                      leftIndent=10, spaceAfter=2),
    'norm':     style('norm',     fontSize=9.5, leading=13, textColor=C_GREEN,
                      leftIndent=10, spaceAfter=2),
    'label':    style('label',    fontSize=8, leading=10, textColor=C_TEXT3,
                      fontName='Helvetica-Bold'),
    'footer':   style('footer',   fontSize=8, leading=10, textColor=C_TEXT3,
                      alignment=1),
}

# ── Утилиты ───────────────────────────────────────────────────────────────────
def p(text, st='body'):
    return Paragraph(str(text), S[st])

def sp(h=6):
    return Spacer(1, h)

def hr(color=C_BORDER, thickness=0.5):
    return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=8, spaceBefore=8)

def level_color(level):
    return {'norm': C_GREEN, 'attention': C_AMBER, 'risk': C_ROSE}.get(level, C_GREY)

def level_label(level):
    return {'norm': 'Норма', 'attention': 'Внимание', 'risk': 'Риск'}.get(level, '—')

def level_bg(level):
    return {'norm': C_GREEN_L, 'attention': C_AMBER_L, 'risk': C_ROSE_L}.get(level, C_GREY_L)

def fmt_date(s):
    if not s:
        return ''
    try:
        return datetime.fromisoformat(s[:10]).strftime('%d.%m.%Y')
    except:
        return str(s)[:10]

def age_str(birth_date):
    if not birth_date:
        return ''
    try:
        bd = datetime.fromisoformat(birth_date[:10])
        today = datetime.today()
        years = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        return f'{years} лет'
    except:
        return ''

def mini_bar_chart(values, labels, max_val=10, width=160, height=60):
    """Мини-гистограмма кривой памяти или динамики."""
    d = Drawing(width, height + 20)
    n   = len(values)
    bw  = (width - 20) / n - 4
    COLORS = [C_INDIGO] * 5 + [C_AMBER]  # последний — отсроченный

    for i, v in enumerate(values):
        bh = max(2, int((v / max(max_val, 1)) * height))
        x  = 10 + i * ((width - 20) / n)
        y  = 0
        col = COLORS[i] if i < len(COLORS) else C_INDIGO
        r = Rect(x, y, bw, bh, fillColor=col, strokeColor=None)
        d.add(r)
        lbl = String(x + bw/2, -12, str(v), fontSize=7, fillColor=C_TEXT2,
                     textAnchor='middle')
        d.add(lbl)
        if labels and i < len(labels):
            ll = String(x + bw/2, -22, str(labels[i]), fontSize=6.5,
                        fillColor=C_TEXT3, textAnchor='middle')
            d.add(ll)

    d.translate(0, 24)
    return d

# ── Блок: шапка страницы ──────────────────────────────────────────────────────
def build_header(student, report_date):
    name = f"{student.get('first_name','')} {student.get('last_name','')}".strip()
    birth = student.get('birth_date','')
    age   = age_str(birth)

    rows = [[
        p(name, 'title'),
        p(f'Дата отчёта: {report_date}', 'small'),
    ]]
    t = Table(rows, colWidths=[W - 100*mm, 40*mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN',  (1,0), (1,0),  'RIGHT'),
    ]))
    items = [t]

    info_parts = []
    if birth:    info_parts.append(f'Дата рождения: {fmt_date(birth)}')
    if age:      info_parts.append(age)
    if info_parts:
        items.append(p(' · '.join(info_parts), 'subtitle'))

    notes = student.get('notes','')
    if notes:
        items.append(sp(4))
        items.append(p(f'Примечания: {notes}', 'body'))

    items.append(sp(4))
    items.append(hr(C_INDIGO, 1.5))
    return items

# ── Блок: сводная таблица ─────────────────────────────────────────────────────
def build_summary_table(diag_results, ex_results):
    items = [p('Сводка результатов', 'h1')]

    rows = [
        [p('Методика / Упражнение', 'label'),
         p('Дата', 'label'),
         p('Результат', 'label'),
         p('Оценка', 'label')],
    ]

    for r in diag_results:
        level = r.get('level','')
        lbl   = level_label(level)
        col   = level_color(level)
        name  = r.get('name') or r.get('method_name','—')
        rows.append([
            p(name, 'body'),
            p(fmt_date(r.get('completed_at','')), 'small'),
            p(r.get('summary','—'), 'small'),
            Paragraph(f'<font color="#{col.hexval()[2:]}"><b>{lbl}</b></font>', S['body']),
        ])

    for r in ex_results:
        correct = r.get('correct', 0)
        total   = r.get('total', 0)
        pct     = round(correct / total * 100) if total > 0 else None
        pct_str = f'{pct}%' if pct is not None else '—'
        col     = C_GREEN if pct and pct >= 80 else C_AMBER if pct and pct >= 50 else C_ROSE
        rows.append([
            p(r.get('exercise_name','—'), 'body'),
            p(fmt_date(r.get('completed_at','')), 'small'),
            p(f'{correct}/{total} правильно' if total > 0 else '—', 'small'),
            Paragraph(f'<font color="#{col.hexval()[2:]}"><b>{pct_str}</b></font>', S['body']),
        ])

    if len(rows) == 1:
        rows.append([p('Нет данных', 'small'), p('','small'), p('','small'), p('','small')])

    col_w = [W - 2*25*mm - 35*mm - 35*mm, 25*mm, 35*mm, 35*mm]
    t = Table(rows, colWidths=col_w, repeatRows=1)
    ts = TableStyle([
        ('BACKGROUND',  (0,0), (-1,0),  C_INDIGO_L),
        ('TEXTCOLOR',   (0,0), (-1,0),  C_INDIGO),
        ('FONTNAME',    (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',    (0,0), (-1,0),  8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_GREY_L]),
        ('GRID',        (0,0), (-1,-1),  0.25, C_BORDER),
        ('VALIGN',      (0,0), (-1,-1),  'MIDDLE'),
        ('TOPPADDING',  (0,0), (-1,-1),  5),
        ('BOTTOMPADDING',(0,0),(-1,-1),  5),
        ('LEFTPADDING', (0,0), (-1,-1),  6),
    ])
    t.setStyle(ts)
    items.append(t)
    return items

# ── Блок: одна диагностика ────────────────────────────────────────────────────
def build_diag_block(r):
    level  = r.get('level','')
    name   = r.get('name') or r.get('method_name','Диагностика')
    date   = fmt_date(r.get('completed_at',''))
    col    = level_color(level)
    bg     = level_bg(level)
    lbl    = level_label(level)
    markers = r.get('markers', [])
    risks   = r.get('risks', [])
    summary = r.get('summary','')

    items = []

    # Заголовок блока
    header_data = [[
        p(name, 'h2'),
        Paragraph(f'<font color="#{col.hexval()[2:]}"><b>{lbl}</b></font>', S['h2']),
    ]]
    ht = Table(header_data, colWidths=[W - 2*25*mm - 40*mm, 40*mm])
    ht.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,0), bg),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), [4,4,4,4]),
        ('TOPPADDING',  (0,0), (-1,-1), 8),
        ('BOTTOMPADDING',(0,0),(-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING',(0,0), (-1,-1), 10),
        ('ALIGN',       (1,0), (1,0),  'RIGHT'),
        ('VALIGN',      (0,0), (-1,-1),'MIDDLE'),
    ]))
    items.append(KeepTogether([ht]))

    if date:
        items.append(p(f'Дата проведения: {date}', 'small'))

    if summary:
        items.append(sp(3))
        items.append(p(summary, 'body'))

    if markers:
        items.append(sp(4))
        for m in markers:
            items.append(p(f'▸  {m}', 'marker'))

    if risks:
        items.append(sp(4))
        for risk in risks:
            items.append(p(risk, 'risk'))

    items.append(sp(8))
    return items

# ── Блок: динамика упражнений ─────────────────────────────────────────────────
def build_exercises_block(ex_results):
    if not ex_results:
        return []

    items = [p('Упражнения', 'h1')]

    # Мини-гистограмма последних 10 результатов
    last10 = [r for r in ex_results if r.get('total',0) > 0][:10]
    if len(last10) >= 3:
        vals   = [round(r['correct']/r['total']*100) for r in reversed(last10)]
        labels = [str(i+1) for i in range(len(vals))]
        items.append(p('Динамика правильных ответов (%, последние результаты):', 'small'))
        items.append(sp(4))
        chart = mini_bar_chart(vals, labels, max_val=100, width=W-2*25*mm-20, height=55)
        items.append(chart)
        items.append(sp(16))

    # Таблица
    rows = [[
        p('Упражнение', 'label'), p('Тип', 'label'),
        p('Результат', 'label'),  p('Время', 'label'), p('Дата', 'label'),
    ]]
    for r in ex_results:
        correct = r.get('correct',0)
        total   = r.get('total',0)
        pct     = round(correct/total*100) if total > 0 else None
        col     = C_GREEN if pct and pct >= 80 else C_AMBER if pct and pct >= 50 else (C_ROSE if pct is not None else C_GREY)
        dur     = r.get('duration_sec',0)
        dur_str = f'{dur}с' if dur else '—'
        pct_str = f'{pct}%' if pct is not None else '—'

        rows.append([
            p(r.get('exercise_name','—'), 'body'),
            p(r.get('exercise_type','—'), 'small'),
            Paragraph(f'<font color="#{col.hexval()[2:]}"><b>{pct_str}</b></font> '
                      f'<font color="#9CA3AF">({correct}/{total})</font>', S['small']),
            p(dur_str, 'small'),
            p(fmt_date(r.get('completed_at','')), 'small'),
        ])

    col_w = [W-2*25*mm-25*mm-40*mm-20*mm-25*mm, 25*mm, 40*mm, 20*mm, 25*mm]
    t = Table(rows, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), C_INDIGO_L),
        ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, C_GREY_L]),
        ('GRID',          (0,0), (-1,-1), 0.25, C_BORDER),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING',   (0,0), (-1,-1), 5),
    ]))
    items.append(t)
    return items

# ── Нумерация страниц ─────────────────────────────────────────────────────────
class PageNumCanvas:
    def __init__(self, doc, student_name, report_date):
        self.doc          = doc
        self.student_name = student_name
        self.report_date  = report_date

    def __call__(self, canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(C_TEXT3)
        # Нижний колонтитул
        footer = f'{self.student_name}  ·  Отчёт от {self.report_date}  ·  Стр. {doc.page}'
        canvas.drawCentredString(W/2, 18*mm, footer)
        # Тонкая линия
        canvas.setStrokeColor(C_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(25*mm, 22*mm, W-25*mm, 22*mm)
        canvas.restoreState()

# ── Главная функция ───────────────────────────────────────────────────────────
def generate(data: dict, output_path: str):
    student     = data.get('student', {})
    diag_results= data.get('diag_results', [])
    ex_results  = data.get('ex_results', [])

    name        = f"{student.get('first_name','')} {student.get('last_name','')}".strip() or 'Ученик'
    report_date = datetime.today().strftime('%d.%m.%Y')

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=25*mm, rightMargin=25*mm,
        topMargin=22*mm, bottomMargin=28*mm,
        title=f'Отчёт: {name}',
        author='Ясная Грань',
    )

    on_page = PageNumCanvas(doc, name, report_date)
    story   = []

    # ── Титульная страница ───────────────────────────────────────────────────
    story += build_header(student, report_date)
    story.append(sp(8))

    # Сводная таблица
    story += build_summary_table(diag_results, ex_results)
    story.append(sp(12))

    # ── Диагностики ──────────────────────────────────────────────────────────
    if diag_results:
        story.append(p('Результаты диагностик', 'h1'))
        story.append(sp(4))
        for r in diag_results:
            story += build_diag_block(r)

    # ── Упражнения ───────────────────────────────────────────────────────────
    if ex_results:
        story.append(sp(8))
        story += build_exercises_block(ex_results)

    # ── Рекомендации (автоматические) ────────────────────────────────────────
    risks = [r for r in diag_results if r.get('level') == 'risk']
    if risks:
        story.append(sp(12))
        story.append(p('Рекомендации', 'h1'))
        risk_names = ', '.join(r.get('name') or r.get('method_name','') for r in risks)
        story.append(p(
            f'По результатам диагностик ({risk_names}) выявлены показатели, '
            f'требующие дополнительного внимания. Рекомендуется консультация '
            f'специалиста (нейропсихолог, логопед, детский психолог) и повторная диагностика '
            f'через 3–4 недели.', 'body'))

    # ── Подпись ───────────────────────────────────────────────────────────────
    story.append(sp(20))
    story.append(hr())
    story.append(p(f'Отчёт сформирован автоматически программой «Ясная Грань» · {report_date}', 'footer'))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'OK:{output_path}')

# ── Точка входа ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: generate_report.py <data.json> <output.pdf>', file=sys.stderr)
        sys.exit(1)

    json_path   = sys.argv[1]
    output_path = sys.argv[2]

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    generate(data, output_path)
