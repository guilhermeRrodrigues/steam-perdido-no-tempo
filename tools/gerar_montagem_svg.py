#!/usr/bin/env python3
"""Gera montagem.svg (ESP32 + mini protoboard + HC-SR04)."""
import sys

W, H = 1500, 840
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
a('<desc id="d">HC-SR04 na mini protoboard: VCC no VIN, Trig no GPIO 5, Echo pelo divisor 1k/2k ate o GPIO 18, GND no GND.</desc>')
a(f'<rect width="{W}" height="{H}" fill="#fbfaf7"/>')

# ---------- Título ----------
text(30, 42, "Perdido no tempo · Montagem do controle", 26, weight="bold", fill="#111827")
text(30, 68, "ESP32 DevKit + mini protoboard + sensor ultrassônico HC-SR04 (vista de cima)", 15, fill="#4b5563")

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
a('<path d="M 220 665 L 220 690 Q 220 700 230 700 L 330 700" fill="none" stroke="#6b7280" stroke-width="9" stroke-linecap="round"/>')
a('<path d="M 330 700 l -2 -6 l 14 6 l -14 6 z" fill="#6b7280"/>')
text(352, 704, "cabo USB de dados → computador", 12, fill="#4b5563")
text(220, 90, "ESP32 DevKit V1", 14, "middle", "bold", "#111827")

# ---------- Protoboard ----------
BX0, BX1, BY0, BY1 = 598, 1002, 372, 646
def cx(c): return 625 + (c - 1) * 22
rows_top = {r: 400 + 22 * i for i, r in enumerate("abcde")}
rows_bot = {r: 532 + 22 * i for i, r in enumerate("fghij")}
ROW = {**rows_top, **rows_bot}
a(f'<rect x="{BX0}" y="{BY0}" width="{BX1-BX0}" height="{BY1-BY0}" rx="8" fill="#f3f1ea" stroke="#c9c4b5" stroke-width="2"/>')
a(f'<rect x="{BX0+6}" y="502" width="{BX1-BX0-12}" height="16" rx="3" fill="#e4e0d3"/>')
for c in range(1, 18):
    for r, y in ROW.items():
        a(f'<rect x="{cx(c)-3.5}" y="{y-3.5}" width="7" height="7" rx="1" fill="#4b4b4b"/>')
    text(cx(c), 514, str(c), 9, "middle", "bold", "#6b6455")
for r, y in ROW.items():
    text(608, y + 3.5, r, 9, "middle", fill="#8a8373")
# destaque das colunas usadas (5 furos ligados)
for c, col in ((1, C_VIN), (2, C_TRIG), (3, "#9ca3af"), (4, C_GND), (8, C_ECHO)):
    a(f'<rect x="{cx(c)-8}" y="391" width="16" height="106" rx="5" fill="none" stroke="{col}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".75"/>')
text(818, 640, "mini protoboard (170 furos) · cada coluna de 5 furos é ligada por dentro", 11, "middle", fill="#6b6455")

# ---------- HC-SR04 ----------
SX0, SX1, SY0, SY1 = 528, 788, 160, 330
a(f'<rect x="{SX0}" y="{SY0}" width="{SX1-SX0}" height="{SY1-SY0}" rx="6" fill="#1565a8" stroke="#0d3f6b" stroke-width="2"/>')
for ccx in (583, 733):
    a(f'<circle cx="{ccx}" cy="235" r="56" fill="#c3c8cf" stroke="#6b7280" stroke-width="2"/>')
    a(f'<circle cx="{ccx}" cy="235" r="44" fill="#3a3a3a"/>')
    for rr in (36, 26, 16):
        a(f'<circle cx="{ccx}" cy="235" r="{rr}" fill="none" stroke="#555" stroke-width="2"/>')
text(658, 185, "HC-SR04", 13, "middle", "bold", "#fff")
text(583, 147, "T (emissor)", 10, "middle", fill="#6b7280")
text(733, 147, "R (receptor)", 10, "middle", fill="#6b7280")
a('<rect x="612" y="314" width="92" height="16" rx="2" fill="#111"/>')
sensor_pins = [("VCC", C_VIN), ("Trig", C_TRIG), ("Echo", C_ECHO), ("GND", C_GND)]
for i, (n, col) in enumerate(sensor_pins):
    x = cx(1 + i)
    text(x, 307, n, 8.5, "middle", "bold", "#fff")
    a(f'<rect x="{x-1.6}" y="330" width="3.2" height="70" fill="#b8bec7" stroke="#7b818a" stroke-width=".6"/>')
    a(f'<circle cx="{x}" cy="400" r="3.4" fill="#8f959e"/>')
# chips de rótulo dos pinos do sensor (à esquerda, com linhas)
for i, (n, col) in enumerate(sensor_pins):
    y = 342 + i * 14
    pass

# ---------- Resistores ----------
def resistor(x1, x2, y, bands, label, label_dy):
    a(f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#9aa0a8" stroke-width="2.4"/>')
    for x in (x1, x2):
        a(f'<circle cx="{x}" cy="{y}" r="3.2" fill="#8f959e"/>')
    mx = (x1 + x2) / 2
    a(f'<rect x="{mx-24}" y="{y-8}" width="48" height="16" rx="7" fill="#e8d4a8" stroke="#a88f5c"/>')
    for i, bc in enumerate(bands):
        bx = mx - 15 + i * 9 if i < 3 else mx + 15
        a(f'<rect x="{bx-2}" y="{y-8}" width="4" height="16" fill="{bc}"/>')
    text(mx, y + label_dy, label, 10.5, "middle", "bold", "#1f2937")

BROWN, BLACK, RED, GOLD = "#7b4a1e", "#111", "#d62828", "#c9a227"
resistor(cx(3), cx(8), ROW["b"], [BROWN, BLACK, RED, GOLD], "", 0)
resistor(cx(8), cx(4), ROW["d"], [RED, BLACK, RED, GOLD], "", 0)

# ---------- Fios ----------
# VIN: col 1 linha e -> por baixo -> lado esquerdo do ESP32
wire([(cx(1), ROW["e"]), (cx(1), 728), (112, 728), (112, PY[14]), (PL - 12, PY[14])], C_VIN)
male_tip(cx(1), ROW["e"], C_VIN)
female_end(PL - 6, PY[14])
# Trig: col 2 linha b -> D5
wire([(cx(2), ROW["b"]), (430, ROW["b"]), (430, PY[7]), (PR + 12, PY[7])], C_TRIG)
male_tip(cx(2), ROW["b"], C_TRIG)
female_end(PR + 6, PY[7])
# GND: col 4 linha c -> GND (lado direito)
wire([(cx(4), ROW["c"]), (400, ROW["c"]), (400, PY[13]), (PR + 12, PY[13])], C_GND)
male_tip(cx(4), ROW["c"], C_GND)
female_end(PR + 6, PY[13])
# Echo/D18: col 8 linha a -> por cima do sensor -> D18
wire([(cx(8), ROW["a"]), (cx(8), 350), (812, 350), (812, 112), (460, 112), (460, PY[6]), (PR + 12, PY[6])], C_ECHO)
male_tip(cx(8), ROW["a"], C_ECHO)
female_end(PR + 6, PY[6])

a(f'<rect x="{cx(1)-6}" y="504" width="12" height="13" rx="3" fill="#fff" stroke="{C_VIN}" stroke-width="1"/>')
text(cx(1), 514, "1", 9, "middle", "bold", "#6b6455")
# ---------- Chamadas (callouts) ----------
def callout(x, y, tx, ty, lines, anchor="start", color="#374151"):
    a(f'<line x1="{x}" y1="{y}" x2="{tx}" y2="{ty}" stroke="{color}" stroke-width="1.2"/>')
    a(f'<circle cx="{x}" cy="{y}" r="2.5" fill="{color}"/>')
    for i, (s, w) in enumerate(lines):
        text(tx + (4 if anchor == "start" else -4), ty + 4 + i * 14, s, 11.5, anchor, w, color)

callout(724, ROW["b"] - 9, 1022, 378, [("Resistor 1 kΩ", "bold"), ("marrom · preto · vermelho", "normal"), ("coluna 3 (Echo) → coluna 8", "normal")])
callout(736, ROW["d"] + 9, 1022, 448, [("Resistor 2 kΩ", "bold"), ("vermelho · preto · vermelho", "normal"), ("coluna 8 → coluna 4 (GND)", "normal")])
a(f'<circle cx="{cx(8)}" cy="{ROW["c"]}" r="7" fill="none" stroke="{C_ECHO}" stroke-width="2.4"/>')
callout(cx(8) + 7, ROW["c"], 1022, 532, [("Meio do divisor ≈ 3,3 V", "bold"), ("daqui sai o fio para o D18", "normal")], color="#0f6b3a")

# rótulos sobre os fios
def tag(x, y, s, col):
    w = 7.2 * len(s) + 12
    a(f'<rect x="{x - w/2}" y="{y-10}" width="{w}" height="20" rx="10" fill="#fff" stroke="{col}" stroke-width="2"/>')
    text(x, y + 4, s, 11, "middle", "bold", col)

tag(636, 112, "Echo → divisor → GPIO 18", C_ECHO)
tag(535, ROW["b"], "Trig → GPIO 5", C_TRIG)
tag(400, 505, "GND → GND", C_GND)
tag(400, 728, "VCC → VIN (5 V)", C_VIN)

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
rows = [("HC-SR04", "Protob.", "ESP32"), ("VCC", "col. 1", "VIN"), ("Trig", "col. 2", "D5"), ("Echo", "col. 3 → 1 kΩ", "—"), ("nó", "col. 8", "D18"), ("GND", "col. 4", "GND")]
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
text(LX + 22, y + 18, "⚠ Desligue o USB para montar.", 11.5, weight="bold", fill="#92400e")
text(LX + 22, y + 35, "VCC e GND trocados queimam", 11, fill="#92400e")
text(LX + 22, y + 50, "o sensor. Nunca ligue o Echo", 11, fill="#92400e")
text(LX + 22, y + 64 - 0, "", 1)
a(f'<text x="{LX+22}" y="{y+65}" font-family="{FONT}" font-size="11" fill="#92400e">direto no ESP32.</text>')

text(30, 825, "Em algumas placas o pino VIN se chama 5V ou VUSB. Os jumpers que vão até o ESP32 são macho-fêmea (a ponta fêmea encaixa no pino da placa).", 11.5, fill="#6b7280")

a("</svg>")
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(out))
