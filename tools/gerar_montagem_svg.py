#!/usr/bin/env python3
"""Gera montagem.svg (ESP32 + mini protoboard + HC-SR04)."""
import sys

W, H = 1510, 910
FONT = "Arial, Helvetica, 'DejaVu Sans', sans-serif"
MONO = "'DejaVu Sans Mono', Consolas, monospace"

C_VIN = "#d62828"
C_GND = "#222222"
C_TRIG = "#1f6fd1"
C_ECHO = "#18a058"

out = []
def a(s): out.append(s)

def text(x, y, s, size=12, anchor="start", weight="normal", fill="#1f2937", family=FONT, extra=""):
    a(f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" {extra}>{s}</text>')

def wire(points, color, r=10):
    """Fio ortogonal com cantos arredondados."""
    d = f"M {points[0][0]} {points[0][1]}"
    for i in range(1, len(points) - 1):
        (x0, y0), (x1, y1), (x2, y2) = points[i - 1], points[i], points[i + 1]
        def toward(px, py, qx, qy, dist):
            dx, dy = qx - px, qy - py
            L = max(abs(dx), abs(dy)) or 1
            rr = min(dist, L / 2)
            return px + dx / L * rr, py + dy / L * rr
        ax, ay = toward(x1, y1, x0, y0, r)
        bx, by = toward(x1, y1, x2, y2, r)
        d += f" L {ax:.1f} {ay:.1f} Q {x1} {y1} {bx:.1f} {by:.1f}"
    d += f" L {points[-1][0]} {points[-1][1]}"
    a(f'<path d="{d}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>')
    a(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
    a(f'<path d="{d}" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1,-1.5)"/>')

def male_tip(x, y, color):
    a(f'<circle cx="{x}" cy="{y}" r="6" fill="{color}" stroke="#000" stroke-opacity=".5" stroke-width="1"/>')
    a(f'<circle cx="{x}" cy="{y}" r="2.4" fill="#c9ced6" stroke="#666" stroke-width=".6"/>')

def female_end(x, y, horizontal=True):
    if horizontal:
        a(f'<rect x="{x-11}" y="{y-6}" width="22" height="12" rx="2" fill="#111" stroke="#555" stroke-width="1"/>')
    else:
        a(f'<rect x="{x-6}" y="{y-11}" width="12" height="22" rx="2" fill="#111" stroke="#555" stroke-width="1"/>')

a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">')
a('<title id="t">Perdido no tempo - montagem do controle (ESP32 + HC-SR04)</title>')
a('<desc id="d">HC-SR04 espetado na fileira a da protoboard de 400 furos: VCC no VIN, Trig no GPIO 5, Echo pelo divisor 1k/2k ate o GPIO 18, GND no GND.</desc>')
a(f'<rect width="{W}" height="{H}" fill="#fbfaf7"/>')

# ---------- Título ----------
text(30, 42, "Perdido no tempo · Montagem do controle", 26, weight="bold", fill="#111827")
text(30, 68, "ESP32 DevKit + protoboard de 400 furos + sensor ultrassônico HC-SR04 (vista de cima)", 15, fill="#4b5563")

# ---------- ESP32 ----------
EX0, EX1, EY0, EY1 = 140, 300, 100, 655
PL, PR = 152, 288
PY = [230 + 26 * i for i in range(15)]
left_pins = ["EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"]
right_pins = ["D23", "D22", "TX0", "RX0", "D21", "D19", "D18", "D5", "TX2", "RX2", "D4", "D2", "D15", "GND", "3V3"]
used = {("L", "VIN"): C_VIN, ("R", "D18"): C_ECHO, ("R", "D5"): C_TRIG, ("R", "GND"): C_GND}

a(f'<rect x="{EX0}" y="{EY0}" width="{EX1-EX0}" height="{EY1-EY0}" rx="10" fill="#1d2b3a" stroke="#0f172a" stroke-width="2"/>')
# módulo WROOM + antena
a(f'<rect x="168" y="106" width="104" height="112" rx="4" fill="#2b2b2b"/>')
a('<path d="M 176 114 h 14 v 14 h 12 v -14 h 12 v 14 h 12 v -14 h 12 v 14 h 12 v -14 h 10" fill="none" stroke="#c9a227" stroke-width="2.5"/>')
a(f'<rect x="174" y="136" width="92" height="76" rx="3" fill="#c7ccd3" stroke="#8b929c"/>')
text(220, 170, "ESP32", 14, "middle", "bold", "#374151")
text(220, 186, "WROOM-32", 10, "middle", fill="#4b5563")
text(220, 205, "antena ↑", 9, "middle", fill="#6b7280")

for side, x, names in (("L", PL, left_pins), ("R", PR, right_pins)):
    for y, n in zip(PY, names):
        col = used.get((side, n))
        a(f'<rect x="{x-5}" y="{y-5}" width="10" height="10" fill="#d4af37" stroke="#7a5c00" stroke-width="1"/>')
        a(f'<circle cx="{x}" cy="{y}" r="2" fill="#5a4500"/>')
        if col:
            lx = x + 10 if side == "L" else x - 10
            w = 34
            rx = lx if side == "L" else lx - w
            a(f'<rect x="{rx}" y="{y-8}" width="{w}" height="16" rx="3" fill="{col}"/>')
            text(rx + w / 2, y + 4, n, 10.5, "middle", "bold", "#fff", MONO)
        else:
            if side == "L":
                text(x + 12, y + 4, n, 9.5, "start", fill="#cbd5e1", family=MONO)
            else:
                text(x - 12, y + 4, n, 9.5, "end", fill="#cbd5e1", family=MONO)

# botões, LED, USB
a('<rect x="160" y="610" width="22" height="18" rx="2" fill="#e5e7eb"/><circle cx="171" cy="619" r="5" fill="#111"/>')
text(171, 642, "EN", 9, "middle", "bold", "#e5e7eb")
a('<rect x="258" y="610" width="22" height="18" rx="2" fill="#e5e7eb"/><circle cx="269" cy="619" r="5" fill="#111"/>')
text(269, 642, "BOOT", 9, "middle", "bold", "#e5e7eb")
a('<rect x="212" y="612" width="8" height="5" fill="#60a5fa"/>')
text(216, 628, "LED", 8, "middle", fill="#93c5fd")
a('<rect x="202" y="643" width="36" height="22" rx="3" fill="#b8bec7" stroke="#6b7280"/>')
# cabo USB
a('<path d="M 220 665 L 220 800" fill="none" stroke="#6b7280" stroke-width="9" stroke-linecap="round"/>')
text(232, 800, "cabo USB de dados → computador", 12, fill="#4b5563")
text(220, 90, "ESP32 DevKit V1", 14, "middle", "bold", "#111827")

# ---------- Protoboard (meia protoboard, 400 furos, 30 colunas) ----------
# Igual às fotos: protoboard deitada, HC-SR04 espetado na fileira "a" (beirada
# de baixo) com os "olhos" para fora, resistores logo ao lado e quatro jumpers
# saindo da fileira "e" até o ESP32.
BX0, BX1, BY0, BY1 = 470, 1176, 262, 670
P = 22
def cx(c): return 507 + (c - 1) * P
ROW = {r: 336 + P * i for i, r in enumerate("jihgf")}
ROW.update({r: 482 + P * i for i, r in enumerate("edcba")})
RAIL_T = (284, 304)
RAIL_B = (612, 632)

a(f'<rect x="{BX0}" y="{BY0}" width="{BX1-BX0}" height="{BY1-BY0}" rx="8" fill="#f3f1ea" stroke="#c9c4b5" stroke-width="2"/>')
# trilhos de alimentação (não usados nesta montagem)
for (y1, y2) in (RAIL_T, RAIL_B):
    a(f'<line x1="{BX0+20}" y1="{y1-10}" x2="{BX1-20}" y2="{y1-10}" stroke="#3b82f6" stroke-width="1.6" opacity=".7"/>')
    a(f'<line x1="{BX0+20}" y1="{y2+10}" x2="{BX1-20}" y2="{y2+10}" stroke="#ef4444" stroke-width="1.6" opacity=".7"/>')
    for c in range(1, 31):
        if (c - 1) % 6 == 5:
            continue
        for y in (y1, y2):
            a(f'<rect x="{cx(c)-3}" y="{y-3}" width="6" height="6" rx="1" fill="#8a8578"/>')
# vale do meio
a(f'<rect x="{BX0+8}" y="{(ROW["f"]+ROW["e"])/2-8}" width="{BX1-BX0-16}" height="16" rx="3" fill="#e4e0d3"/>')
used = {17: C_ECHO, 20: C_VIN, 21: C_TRIG, 22: "#9ca3af", 23: C_GND}
for c in range(1, 31):
    for r, y in ROW.items():
        a(f'<rect x="{cx(c)-3.5}" y="{y-3.5}" width="7" height="7" rx="1" fill="#4b4b4b"/>')
    bold = "bold" if c in used else "normal"
    colr = used.get(c, "#8a8373") if c in used else "#8a8373"
    text(cx(c), ROW["j"] - 14, str(c), 8.5, "middle", bold, "#8a8373")
    text(cx(c), (ROW["f"] + ROW["e"]) / 2 + 3.5, str(c), 9, "middle", bold, colr)
for r, y in ROW.items():
    text(BX0 + 16, y + 3.5, r, 9, "middle", fill="#8a8373")
    text(BX1 - 14, y + 3.5, r, 9, "middle", fill="#8a8373")
# destaque das colunas usadas (a–e, 5 furos ligados por dentro)
for c, col in used.items():
    a(f'<rect x="{cx(c)-8}" y="{ROW["e"]-10}" width="16" height="{ROW["a"]-ROW["e"]+20}" rx="5" fill="none" stroke="{col}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".8"/>')
text(BX0 + 12, BY1 - 7, "protoboard de 400 furos · em cada coluna, os furos a-b-c-d-e são ligados por dentro", 10.5, "start", fill="#6b6455")

# ---------- HC-SR04 (em pé na beirada, olhando para fora) ----------
pins = [(20, "VCC", C_VIN), (21, "Trig", C_TRIG), (22, "Echo", C_ECHO), (23, "GND", C_GND)]
SCX = (cx(20) + cx(23)) / 2
SX0, SX1, SY0, SY1 = SCX - 135, SCX + 135, 684, 816
# pernas do conector entrando na fileira a
for c, n, col in pins:
    a(f'<rect x="{cx(c)-1.6}" y="{ROW["a"]}" width="3.2" height="{SY0-ROW["a"]+4}" fill="#b8bec7" stroke="#7b818a" stroke-width=".6"/>')
    a(f'<circle cx="{cx(c)}" cy="{ROW["a"]}" r="3.6" fill="#8f959e"/>')
a(f'<rect x="{cx(20)-12}" y="{SY0-12}" width="{cx(23)-cx(20)+24}" height="14" rx="2" fill="#111"/>')
a(f'<rect x="{SX0}" y="{SY0}" width="{SX1-SX0}" height="{SY1-SY0}" rx="6" fill="#1565a8" stroke="#0d3f6b" stroke-width="2"/>')
for ccx in (SX0 + 62, SX1 - 62):
    a(f'<circle cx="{ccx}" cy="{SY0+70}" r="50" fill="#c3c8cf" stroke="#6b7280" stroke-width="2"/>')
    a(f'<circle cx="{ccx}" cy="{SY0+70}" r="39" fill="#3a3a3a"/>')
    for rr in (31, 22, 13):
        a(f'<circle cx="{ccx}" cy="{SY0+70}" r="{rr}" fill="none" stroke="#555" stroke-width="2"/>')
a(f'<rect x="{SCX-22}" y="{SY0+16}" width="44" height="18" rx="8" fill="#d9dde2" stroke="#8b929c"/>')
text(SCX, SY0 + 52, "HC-SR04", 12, "middle", "bold", "#fff")
for c, n, col in pins:
    text(cx(c), SY0 + 12, n, 7.5, "middle", "bold", "#fff")
text(SCX, SY1 + 18, "sensor em pé na beirada, com os \"olhos\" para fora da protoboard", 11, "middle", fill="#4b5563")

# ---------- Resistores ----------
def resistor(c1, c2, y, bands):
    x1, x2 = cx(c1), cx(c2)
    a(f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#9aa0a8" stroke-width="2.4"/>')
    for x in (x1, x2):
        a(f'<circle cx="{x}" cy="{y}" r="3.4" fill="#8f959e"/>')
    mx = (x1 + x2) / 2
    a(f'<rect x="{mx-22}" y="{y-7.5}" width="44" height="15" rx="7" fill="#e8d4a8" stroke="#a88f5c"/>')
    for i, bc in enumerate(bands):
        bx = mx - 13 + i * 8 if i < 3 else mx + 14
        a(f'<rect x="{bx-2}" y="{y-7.5}" width="4" height="15" fill="{bc}"/>')
    return mx

BROWN, BLACK, RED, GOLD = "#7b4a1e", "#111", "#d62828", "#c9a227"
m1 = resistor(22, 17, ROW["c"], [BROWN, BLACK, RED, GOLD])   # 1k: Echo -> nó
m2 = resistor(17, 23, ROW["b"], [RED, BLACK, RED, GOLD])     # 2k: nó -> GND

# ---------- Fios (jumpers macho-fêmea, curvos como nas fotos) ----------
def smooth(points):
    """Catmull-Rom -> Bezier cúbica passando por todos os pontos."""
    d = f"M {points[0][0]:.1f} {points[0][1]:.1f}"
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d

def jumper(points, color):
    d = smooth(points)
    a(f'<path d="{d}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="9" stroke-linecap="round" transform="translate(2,3)"/>')
    a(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round"/>')
    a(f'<path d="{d}" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="1.6" stroke-linecap="round" transform="translate(-1,-1.5)"/>')

E = ROW["e"]
# Echo/nó: coluna 17 -> D18
jumper([(cx(17), E), (cx(17) - 20, 390), (720, 300), (470, 330), (PR + 30, PY[6])], C_ECHO)
# Trig: coluna 21 -> D5
jumper([(cx(21), E), (cx(21) - 10, 380), (780, 250), (480, 300), (PR + 30, PY[7])], C_TRIG)
# GND: coluna 23 -> GND (lado direito do ESP32)
jumper([(cx(23), E), (cx(23) + 6, 400), (870, 230), (560, 270), (390, 480), (PR + 30, PY[13])], C_GND)
# VCC: coluna 20 -> VIN (lado esquerdo, por baixo da placa)
jumper([(cx(20), E), (cx(20) - 14, 410), (820, 215), (430, 215), (360, 560), (300, 735), (150, 745), (100, 680), (PL - 30, PY[14])], C_VIN)
for c, col in ((17, C_ECHO), (21, C_TRIG), (23, C_GND), (20, C_VIN)):
    male_tip(cx(c), E, col)
for y in (PY[6], PY[7], PY[13]):
    a(f'<line x1="{PR+8}" y1="{y}" x2="{PR+30}" y2="{y}" stroke="#111" stroke-width="6"/>')
    female_end(PR + 14, y)
a(f'<line x1="{PL-30}" y1="{PY[14]}" x2="{PL-8}" y2="{PY[14]}" stroke="#111" stroke-width="6"/>')
female_end(PL - 14, PY[14])

# ---------- Chamadas (callouts) ----------
def callout(x, y, tx, ty, lines, anchor="start", color="#374151"):
    a(f'<polyline points="{x},{y} {tx + (0 if anchor == "start" else 0)},{ty}" fill="none" stroke="{color}" stroke-width="1.2"/>')
    a(f'<circle cx="{x}" cy="{y}" r="2.5" fill="{color}"/>')
    for i, (s, w) in enumerate(lines):
        text(tx + (4 if anchor == "start" else -4), ty + 4 + i * 14, s, 11.5, anchor, w, color)

callout(m1 - 6, ROW["c"] + 7, 640, 748, [("Resistor 1 kΩ (fileira c)", "bold"), ("marrom · preto · vermelho", "normal"), ("coluna 22 (Echo) → coluna 17", "normal")], "end")
callout(m2 + 10, ROW["b"] + 7, 640, 806, [("Resistor 2 kΩ (fileira b)", "bold"), ("vermelho · preto · vermelho", "normal"), ("coluna 17 → coluna 23 (GND)", "normal")], "end")
a(f'<circle cx="{cx(17)}" cy="{ROW["d"]}" r="7" fill="none" stroke="{C_ECHO}" stroke-width="2.4"/>')
callout(cx(17) - 7, ROW["d"], 640, 698, [("Meio do divisor ≈ 3,3 V", "bold"), ("coluna 17: daqui sai o fio do D18", "normal")], "end", color="#0f6b3a")

# rótulos sobre os fios
def tag(x, y, s, col):
    w = 7.2 * len(s) + 12
    a(f'<rect x="{x - w/2}" y="{y-10}" width="{w}" height="20" rx="10" fill="#fff" stroke="{col}" stroke-width="2"/>')
    text(x, y + 4, s, 11, "middle", "bold", col)

tag(1010, 160, "Echo → divisor → D18", C_ECHO)
tag(1010, 190, "Trig → D5", C_TRIG)
tag(1010, 220, "GND → GND", C_GND)
tag(1010, 130, "VCC → VIN (5 V)", C_VIN)
text(1010, 106, "Os 4 jumpers, da protoboard (fileira e) até o ESP32", 11, "middle", "bold", "#374151")

# ---------- Painel lateral: legenda ----------
LX = 1240
a(f'<rect x="{LX}" y="96" width="250" height="730" rx="10" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>')
text(LX + 16, 124, "Legenda dos fios", 15, weight="bold", fill="#111827")
leg = [
    (C_VIN, "Vermelho: alimentação", "VCC do sensor → VIN (5 V)"),
    (C_GND, "Preto: terra (GND)", "GND do sensor → GND"),
    (C_TRIG, "Azul: Trig", "Trig → GPIO 5 (D5), direto"),
    (C_ECHO, "Verde: Echo", "Echo → 1 kΩ → nó → GPIO 18"),
]
y = 152
for col, t1, t2 in leg:
    a(f'<line x1="{LX+16}" y1="{y}" x2="{LX+46}" y2="{y}" stroke="{col}" stroke-width="6" stroke-linecap="round"/>')
    text(LX + 56, y + 1, t1, 12, weight="bold", fill="#111827")
    text(LX + 56, y + 16, t2, 11, fill="#4b5563")
    y += 40

y += 4
text(LX + 16, y, "Ligações", 15, weight="bold", fill="#111827")
y += 10
rows = [("HC-SR04", "Protob.", "ESP32"), ("VCC", "col. 20", "VIN"), ("Trig", "col. 21", "D5"), ("Echo", "col. 22 → 1 kΩ", "—"), ("nó", "col. 17", "D18"), ("GND", "col. 23", "GND")]
for i, (p, c, e) in enumerate(rows):
    yy = y + 6 + i * 22
    if i == 0:
        a(f'<rect x="{LX+12}" y="{yy-2}" width="226" height="22" rx="4" fill="#f3f4f6"/>')
    w = "bold" if i == 0 else "normal"
    text(LX + 20, yy + 14, p, 11.5, weight="bold" if i else "bold", fill="#111827")
    text(LX + 92, yy + 14, c, 11.5, weight=w, fill="#374151")
    text(LX + 190, yy + 14, e, 11.5, weight="bold", fill="#111827")
y = y + 6 + len(rows) * 22 + 22

# esquema do divisor
text(LX + 16, y, "Divisor de tensão", 15, weight="bold", fill="#111827")
y += 14
gx = LX + 70
a(f'<text x="{gx}" y="{y+12}" font-family="{FONT}" font-size="11" text-anchor="middle" fill="#111827" font-weight="bold">Echo (5 V)</text>')
def zig(x, y0, y1):
    pts = [(x, y0)]
    n = 6
    step = (y1 - y0) / n
    for k in range(n):
        pts.append((x + (8 if k % 2 == 0 else -8), y0 + step * (k + 0.5)))
    pts.append((x, y1))
    return " ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
yt = y + 18
a(f'<line x1="{gx}" y1="{yt}" x2="{gx}" y2="{yt+10}" stroke="{C_ECHO}" stroke-width="2.5"/>')
a(f'<polyline points="{zig(gx, yt+10, yt+50)}" fill="none" stroke="#111" stroke-width="2"/>')
text(gx + 16, yt + 34, "1 kΩ", 11.5, weight="bold")
yn = yt + 66
a(f'<line x1="{gx}" y1="{yt+50}" x2="{gx}" y2="{yn+16}" stroke="#111" stroke-width="2"/>')
a(f'<circle cx="{gx}" cy="{yn}" r="4" fill="{C_ECHO}"/>')
a(f'<line x1="{gx}" y1="{yn}" x2="{gx+70}" y2="{yn}" stroke="{C_ECHO}" stroke-width="2.5"/>')
text(gx + 76, yn + 4, "GPIO 18", 11.5, weight="bold", fill="#0f6b3a")
text(gx + 76, yn + 18, "≈ 3,3 V", 11, fill="#0f6b3a")
a(f'<polyline points="{zig(gx, yn+16, yn+56)}" fill="none" stroke="#111" stroke-width="2"/>')
text(gx + 16, yn + 40, "2 kΩ", 11.5, weight="bold")
yg = yn + 70
a(f'<line x1="{gx}" y1="{yn+56}" x2="{gx}" y2="{yg}" stroke="#111" stroke-width="2"/>')
for k, hw in enumerate((14, 9, 4)):
    a(f'<line x1="{gx-hw}" y1="{yg+k*4}" x2="{gx+hw}" y2="{yg+k*4}" stroke="#111" stroke-width="2"/>')
text(gx + 22, yg + 8, "GND", 11.5, weight="bold")
text(LX + 16, yg + 34, "5 V × 2k ÷ (1k + 2k) = 3,33 V", 11.5, fill="#374151", family=MONO)
text(LX + 16, yg + 50, "Sem 2 kΩ? Use dois de 1 kΩ", 11, fill="#4b5563")
text(LX + 16, yg + 64, "em série no lugar dele.", 11, fill="#4b5563")

# avisos
y = yg + 88
a(f'<rect x="{LX+12}" y="{y}" width="226" height="78" rx="6" fill="#fef3c7" stroke="#f59e0b"/>')
text(LX + 22, y + 18, "Atenção: desligue o USB para montar.", 11.5, weight="bold", fill="#92400e")
text(LX + 22, y + 35, "VCC e GND trocados queimam", 11, fill="#92400e")
text(LX + 22, y + 50, "o sensor. Nunca ligue o Echo", 11, fill="#92400e")
text(LX + 22, y + 64 - 0, "", 1)
a(f'<text x="{LX+22}" y="{y+65}" font-family="{FONT}" font-size="11" fill="#92400e">direto no ESP32.</text>')

text(30, 884, "Em algumas placas o pino VIN se chama 5V ou VUSB. Jumpers macho-fêmea: a ponta fêmea encaixa no pino do ESP32.", 11.5, fill="#6b7280")
text(30, 902, "As colunas são um exemplo: qualquer coluna serve, desde que as ligações sejam as mesmas. A cor dos seus jumpers pode ser outra; o que vale é o pino.", 11.5, fill="#6b7280")

a("</svg>")
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(out))
