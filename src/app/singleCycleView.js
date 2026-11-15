// Single-cycle datapath view: diagram labels, step lesson, info panels.
import { extraControlBadges, routeAnchors } from '../diagrams/layout/singleCycle.js';
import { controlKeys as keys } from '../domain/controlTable.js';
import { flowTrace, instructionBits, instructions, liveValues, stageHeb } from '../domain/instructions.js';
import { routeInfo, routeLessons, signalLessons, stageWires } from '../domain/singleCycle.js';
import { instructionComputed } from '../simulator/single-cycle/addressing.js';
import { renderControlTable, setMode } from './appControls.js';
import { state, timers } from './context.js';

export function activeStep() {
  return instructions[state.inst].steps[Math.min(state.step, instructions[state.inst].steps.length - 1)];
}

export const diagramSvg = document.querySelector('.diagram'),
  wirePaths = [...diagramSvg.querySelectorAll('path.wire')],
  routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
routeLayer.setAttribute('class', 'route-label-layer');
diagramSvg.appendChild(routeLayer);
export const controlBadgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
controlBadgeLayer.setAttribute('id', 'control-value-layer');
controlBadgeLayer.setAttribute('aria-hidden', 'true');
diagramSvg.appendChild(controlBadgeLayer);

export function updateControlValueBadges() {
  const d = instructions[state.inst];
  controlBadgeLayer.replaceChildren();
  extraControlBadges.forEach(([key, x, y]) => {
    const value =
        key === 'ALUOp'
          ? `${d.controls.ALUOp1 ?? 'X'}${d.controls.ALUOp0 ?? 'X'}`
          : `${d.controls[key] ?? 'X'}`,
      label = `${key}=${value}`,
      w = Math.max(48, label.length * 4.4 + 12),
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'control-value-badge');
    g.setAttribute('transform', `translate(${x},${y})`);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', -w / 2);
    rect.setAttribute('y', -9);
    rect.setAttribute('width', w);
    rect.setAttribute('height', 18);
    rect.setAttribute('rx', 5);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 3);
    text.textContent = label;
    g.append(rect, text);
    controlBadgeLayer.appendChild(g);
  });
}
export const routeTags = wirePaths.map((path, i) => {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'route-tag');
  g.setAttribute('data-route', i);
  g.setAttribute('role', 'button');
  g.setAttribute('tabindex', '0');
  g.setAttribute('aria-label', `פס ${i + 1}: פתחי הסבר`);
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('rx', '5');
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('text-anchor', 'middle');
  g.append(rect, text);
  routeLayer.appendChild(g);
  g.addEventListener('click', () => showRouteInfo(i));
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showRouteInfo(i);
    }
  });
  return { g, rect, text };
});
export function activeWireIds(name, stage) {
  let ids = stageWires[stage] || [];
  if (stage === 'alu') ids = [8, name === 'add' || name === 'beq' ? 9 : 12, 15, 30];
  if (stage === 'mem') ids = name === 'lw' ? [15, 16, 17] : name === 'sw' ? [10, 15] : [];
  if (stage === 'writeback')
    ids = name === 'lw' ? [17, 19, 32] : ['add', 'addi'].includes(name) ? [18, 19, 32] : [];
  if (stage === 'extend' && name === 'beq') ids = [11, 13, 25];
  if (stage === 'extend' && name !== 'beq') ids = [11, 12];
  return ids;
}
export function wireTagText(name, i, raw) {
  const v = wireDisplayValue(raw || 'X'),
    d = instructions.find((x) => x.name === name),
    c = d.controls,
    z = instructionComputed(name),
    hex = (n) => '0x' + (n >>> 0).toString(16).padStart(8, '0');
  const num = (re) => v.match(re)?.[1] || 'X';
  if (v.startsWith('X') && ![21, 27].includes(i)) return 'X';
  switch (i) {
    case 0:
    case 2:
      return 'PC=0x00400000';
    case 1:
      return 'Instr=' + num(/Instr=(0x[\da-f]+)/i);
    case 3:
      return 'PC+4=0x00400004';
    case 4:
      return 'rs=' + num(/rs=(\d+)/);
    case 5:
      return 'rt=' + num(/rt=(\d+)/);
    case 6:
      return 'RegWrite=' + (c.RegWrite ?? 'X');
    case 7:
      return v.replace(' נבחר', '');
    case 8:
      return v.replace(' → ALU A', '');
    case 9:
      return v.replace(' → MUX', '');
    case 10:
      return v.replace(/ · MemWrite=/, ' · MW=');
    case 11:
      return v.replace(' (לא נבחר)', '');
    case 12:
      return v.replace(' (לא נבחר)', '');
    case 13:
      return v.replace('offset<<2=', '<<2=');
    case 14:
      return v.replace('יעד מחושב ', '');
    case 15:
      return /\d/.test(v) ? 'ALU=' + num(/(?:ALU result|ALU)=(\d+)/) + '→Address' : 'X';
    case 16:
      return v.startsWith('M[') ? v.replace(' · MemRead=1', '') : 'ReadData=X';
    case 17:
      return v.startsWith('42') ? 'ReadData=42' : 'ReadData=X';
    case 18:
      return /\d/.test(v) ? v.replace(' נבחר', '') : 'X';
    case 19:
      return v.startsWith('אין') ? 'X' : v.replace(' → ', '→');
    case 20:
      return 'Instr[25:0]=' + ('0x' + z.field.toString(16).padStart(7, '0'));
    case 21:
      return 'Jaddr=' + hex(z.jumpTarget);
    case 22:
      return 'Branch=' + (c.Branch ?? 'X');
    case 23:
      return 'Zero=' + num(/Zero=(\d+)/);
    case 24:
      return v.replace('AND=', 'AND/').replace(' · PCSrc=', ' · ');
    case 25:
      return v.replace('offset<<2=', '<<2=');
    case 26:
      return 'PC+4[31:28]=0x0';
    case 27:
      return 'BranchTarget=' + hex(z.branchTarget);
    case 28:
      return v.replace('PCSrc=', 'PCSrc=');
    case 29:
      return v.replace('PC הבא=', 'PC=');
    case 30:
      return v.replace('MUX out=', 'B=').replace(' → ALU B', '');
    case 31:
      return 'ALUSrc=' + (c.ALUSrc ?? 'X');
    case 32:
      return 'MemtoReg=' + (c.MemtoReg ?? 'X');
    case 33:
      return v.replace(' → input 0', '');
    case 34:
      return v.replace(' → input 1', '');
    case 35:
      return 'RegDst=' + (c.RegDst ?? 'X');
    default:
      return v.replace(/ → /g, '→').replace(' נבחר', '').replace(' (לא נבחר)', '');
  }
}
export function updateRouteLabels(name, stage) {
  const info = routeInfo[name],
    alwaysShown = [0, 1, 2, 3, 6, 15, 16, 17, 22, 28, 29, 31, 32, 35],
    visible = new Set(
      state.showAllRoutes
        ? wirePaths.map((_, i) => i)
        : [...alwaysShown, ...packetPlan(name, stage).map((p) => p[0])],
    ),
    occupied = [];
  const keepouts = [
    [82, 37, 80, 24],
    [397, 330, 70, 24],
    [410, 525, 70, 24],
    [630, 295, 70, 24],
    [970, 420, 75, 24],
    [755, 411, 100, 24],
  ];
  const candidates = [
    [0, 0],
    [0, -18],
    [0, 18],
    [0, -34],
    [0, 34],
    [-20, 0],
    [20, 0],
    [-20, -18],
    [20, -18],
    [-20, 18],
    [20, 18],
    [0, -50],
    [0, 50],
    [-38, 0],
    [38, 0],
    [-38, -18],
    [38, -18],
    [-38, 18],
    [38, 18],
  ];
  const overlaps = (a, b) =>
    a[0] < b[0] + b[2] + 3 && a[0] + a[2] + 3 > b[0] && a[1] < b[1] + b[3] + 3 && a[1] + a[3] + 3 > b[1];
  routeTags.forEach(({ g, rect, text }, i) => {
    const raw = info[i] || 'X',
      value = wireDisplayValue(raw),
      label = wireTagText(name, i, raw),
      [ax, ay] = routeAnchors[i],
      width = Math.max(34, Math.min(128, label.length * 3.8 + 10)),
      height = 15;
    text.textContent = label;
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('font-size', '7');
    const options = candidates.map(([dx, dy]) => [ax + dx, ay + dy]);
    let chosen = options.find(([x, y]) => {
      const box = [x - width / 2, y - height / 2, width, height];
      return (
        x - width / 2 >= 4 &&
        x + width / 2 <= 1236 &&
        y - height / 2 >= 4 &&
        y + height / 2 <= 616 &&
        !occupied.some((o) => overlaps(box, o)) &&
        !keepouts.some((o) => overlaps(box, o))
      );
    });
    if (!chosen)
      chosen = options.find(
        ([x, y]) =>
          x - width / 2 >= 4 && x + width / 2 <= 1236 && y - height / 2 >= 4 && y + height / 2 <= 616,
      ) || [ax, ay];
    const [x, y] = chosen,
      box = [x - width / 2, y - height / 2, width, height];
    if (visible.has(i)) occupied.push(box);
    text.setAttribute('x', x);
    text.setAttribute('y', y + 2.5);
    rect.setAttribute('x', x - width / 2);
    rect.setAttribute('y', y - height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    g.classList.toggle('unused', label === 'X' || /לא נבחר|לא רלוונטי|לא בשימוש|אין כתיבה/.test(label));
    g.classList.toggle('control-value', [6, 22, 28, 31, 32, 35].includes(i));
    g.classList.toggle('hidden', !visible.has(i));
    g.onmouseenter = (e) => {
      state.infoPinned = false;
      showWireHover(i, e);
    };
    g.onmousemove = (e) => {
      if (!state.infoPinned) showWireHover(i, e);
    };
    g.onmouseleave = hideDiagramHover;
    const routeDescription = `פס ${i + 1}: ${value}. ${routeLessons[i]?.[1] || 'הפס מחבר בין רכיבים בתרשים.'}`;
    g.setAttribute('aria-label', routeDescription);
    g.setAttribute('data-wire-value', label);
    wirePaths[i].setAttribute('aria-label', routeDescription);
    wirePaths[i].setAttribute('tabindex', '0');
    wirePaths[i].style.cursor = 'help';
    wirePaths[i].onmouseenter = (e) => {
      state.infoPinned = false;
      showWireHover(i, e);
    };
    wirePaths[i].onmousemove = (e) => {
      if (!state.infoPinned) showWireHover(i, e);
    };
    wirePaths[i].onmouseleave = hideDiagramHover;
    wirePaths[i].onfocus = () => showWireHover(i, null);
    wirePaths[i].onblur = hideDiagramHover;
    wirePaths[i].onclick = () => showRouteInfo(i);
    wirePaths[i].onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showRouteInfo(i);
      }
    };
  });
}
export function openInfo(title, body, calc = '') {
  const panel = document.getElementById('info-panel');
  clearTimeout(timers.hoverHideTimer);
  state.infoPinned = true;
  panel.classList.remove('hovering');
  panel.style.left = 'auto';
  panel.style.right = '18px';
  panel.style.top = '122px';
  panel.classList.add('open');
  document.getElementById('info-title').textContent = title;
  document.getElementById('info-body').textContent = body;
  document.getElementById('info-calc').textContent =
    calc || 'נסי לעקוב אחרי החץ: הוא מראה לאיזה רכיב הערך מגיע.';
  const box = document.querySelector('.diagram-wrap').getBoundingClientRect();
  if (box.bottom < 0 || box.top > innerHeight)
    document.querySelector('.diagram-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function showDiagramHover(title, body, calc, event) {
  const panel = document.getElementById('info-panel');
  if (!panel || state.infoPinned) return;
  clearTimeout(timers.hoverHideTimer);
  document.getElementById('info-title').textContent = title;
  document.getElementById('info-body').textContent = body;
  document.getElementById('info-calc').textContent = calc || '';
  panel.classList.add('open', 'hovering');
  panel.style.left = 'auto';
  panel.style.right = '18px';
  panel.style.top = '122px';
}
export function hideDiagramHover() {
  if (state.infoPinned) return;
  clearTimeout(timers.hoverHideTimer);
  timers.hoverHideTimer = setTimeout(() => {
    if (!state.infoPinned) document.getElementById('info-panel')?.classList.remove('open', 'hovering');
  }, 140);
}
export function showWireHover(i, event) {
  const d = instructions[state.inst],
    lesson = routeLessons[i],
    value = wireDisplayValue(routeInfo[d.name][i] || 'X');
  showDiagramHover(
    `פס ${i + 1} · ${lesson[0]}`,
    `בפקודת ${d.name}: ${value}. ${lesson[1]}`,
    lesson[2],
    event,
  );
}
export function wireDisplayValue(value) {
  if (!value) return 'X';
  if (/field לא בשימוש|לא נבחרים/.test(value)) return 'X — אין ערך מוגדר';
  if (/לא נבחר|לא רלוונטי|לא בשימוש|אין כתיבה|אין קריאה/.test(value) && !/[0-9]/.test(value))
    return 'X — אין ערך פעיל';
  return value;
}
export function renderWireValues() {
  const d = instructions[state.inst],
    box = document.getElementById('wire-values');
  box.innerHTML = routeLessons
    .map((lesson, i) => {
      const value = wireDisplayValue(routeInfo[d.name][i] || 'X');
      return `<button type="button" class="wire-value-row" data-wire-value="${i}"><span class="wire-number">פס ${i + 1}</span><span class="wire-value"><b>${lesson[0]}:</b> ${value}</span></button>`;
    })
    .join('');
  box
    .querySelectorAll('[data-wire-value]')
    .forEach((b) => (b.onclick = () => showRouteInfo(+b.dataset.wireValue)));
  const cbox = document.getElementById('control-wire-values');
  cbox.innerHTML = keys
    .map(
      (k) =>
        `<button type="button" class="wire-value-row" data-control-wire="${k}"><span class="wire-number">${k}</span><span class="wire-value">${d.controls[k] ?? 'X'}</span></button>`,
    )
    .join('');
  cbox
    .querySelectorAll('[data-control-wire]')
    .forEach((b) => (b.onclick = () => showSignalInfo(b.dataset.controlWire)));
}
export function showRouteInfo(i) {
  const d = instructions[state.inst],
    value = routeInfo[d.name][i] || 'X',
    lesson = routeLessons[i],
    z = instructionComputed(d.name),
    hex = (n) => '0x' + (n >>> 0).toString(16).padStart(8, '0');
  if (i === 1 && d.name === 'add') {
    openInfo(
      'קוד הפקודה add · 0x012A4020',
      'זהו לא חישוב של ה־ALU. זהו קוד המכונה של add, כתוב בקיצור הקסדצימלי. כל שתי ספרות הקסדצימליות מייצגות 8 ביטים.',
      'פירוק ל־32 ביטים: opcode 000000 | rs 01001 (R9=$t1) | rt 01010 (R10=$t2) | rd 01000 (R8=$t0) | shamt 00000 | funct 100000 (add). כך המעבד יודע לחבר את R9 ו־R10 ולשמור ב־R8.',
    );
    return;
  }
  if (i === 20) {
    openInfo(
      'המידע על הפס: Instr[25:0]',
      `על החוט עוברים 26 הביטים התחתונים של הפקודה ${d.name}: ${'0x' + z.field.toString(16).padStart(7, '0')}. הביטים קיימים גם כשהפקודה אינה j.`,
      `רק פקודת j משתמשת בהם כדי לבחור כתובת קפיצה; בשאר הפקודות הם עוברים בחוט אך לא נבחרים.`,
    );
    return;
  }
  if (i === 21) {
    openInfo(
      'המידע על הפס: כתובת קפיצה',
      `החוט מציג את הכתובת שנבנית מהשדה Instr[25:0]: ${hex(z.jumpTarget)}.`,
      `החישוב הוא שדה היעד << 2 יחד עם 4 הביטים העליונים של PC+4. רק j בוחרת בכתובת הזו; לכן בפקודות אחרות היא מחושבת אך לא נבחרת.`,
    );
    return;
  }
  if (i === 27) {
    openInfo(
      'המידע על הפס: יעד branch',
      `החוט מציג את היעד המחושב לפי ה־immediate של הפקודה: ${hex(z.branchTarget)}.`,
      `החישוב: PC+4 ועוד ה־immediate המורחב אחרי הזזה שמאלה ב־2. היעד נבחר רק כאשר Branch וגם Zero שווים 1.`,
    );
    return;
  }
  openInfo(
    `פס ${i + 1} · ${lesson[0]}`,
    `בפקודת ${d.name} המידע על הפס הוא: ${wireDisplayValue(value)}. ${lesson[1]}`,
    lesson[2],
  );
}
export function muxTeaching(component, d, live) {
  const fields = instructionBits[d.name] || [],
    bits = (k) => fields.find((x) => x[0] === k)?.[1] || 'X',
    rt = bits('rt') === 'X' ? 'X' : `${parseInt(bits('rt'), 2)} (${bits('rt')})`,
    rdBits = d.name === 'add' ? bits('rd') : bits('immediate') === 'X' ? 'X' : bits('immediate').slice(0, 5),
    rd = rdBits === 'X' ? 'X' : `${parseInt(rdBits, 2)} (${rdBits})`,
    aluOut = { add: 12, addi: 15, lw: 104, sw: 104, beq: 0 },
    read2 = { add: 5, addi: 0, lw: 42, sw: 42, beq: 7 },
    imm = { addi: 8, lw: 4, sw: 4, beq: 3 },
    memOut = { lw: 42 };
  const src = component.toLowerCase();
  if (src.includes('alusrc')) {
    const sel = d.controls.ALUSrc,
      inputs = [
        `כניסה 0: Read Data 2 = ${read2[d.name] ?? 'X'}`,
        `כניסה 1: Sign Extend = ${imm[d.name] ?? 'X'}`,
      ],
      out = sel === 0 ? read2[d.name] : sel === 1 ? imm[d.name] : 'X';
    return {
      title: 'MUX · ALUSrc',
      body: `מה נכנס: ${inputs.join(' · ')}. אות הבחירה ALUSrc=${sel ?? 'X'} ${sel === 0 ? 'בוחר בכניסה 0 (האוגר).' : sel === 1 ? 'בוחר בכניסה 1 (המספר מהפקודה).' : 'לא מוגדר בפקודה הזו.'}`,
      calc: `מה יוצא לכיוון ALU B: ${out === undefined ? 'X' : out}. ${d.name === 'add' ? 'ה־ALU יקבל 5 כאופרנד השני.' : d.name === 'addi' ? 'ה־ALU יקבל immediate=8 כאופרנד השני.' : ''}`,
    };
  }
  if (src.includes('regdst')) {
    const sel = d.controls.RegDst,
      inputs = [`כניסה 0: rt = ${rt}`, `כניסה 1: rd/Instr[15:11] = ${rd}`],
      out = sel === 0 ? rt : sel === 1 ? rd : 'X';
    return {
      title: 'MUX · RegDst',
      body: `מה נכנס: ${inputs.join(' · ')}. RegDst=${sel ?? 'X'} ${sel === 0 ? 'בוחר את rt.' : sel === 1 ? 'בוחר את rd.' : 'הבחירה לא חשובה כי לא כותבים לאוגר.'}`,
      calc: `כתובת האוגר שיוצאת ל־Write Addr: ${d.controls.RegWrite ? out : 'X — RegWrite=0, אין כתיבה לאוגר'}.`,
    };
  }
  if (src.includes('memtoreg')) {
    const a = aluOut[d.name] ?? 'X',
      m = memOut[d.name] ?? 'X',
      sel = d.controls.MemtoReg,
      out = sel === 0 ? a : sel === 1 ? m : 'X';
    return {
      title: 'MUX · MemtoReg',
      body: `מה נכנס: כניסה 0 תוצאת ALU=${a}; כניסה 1 נתון מהזיכרון=${m}. MemtoReg=${sel ?? 'X'} ${sel === 0 ? 'בוחר בתוצאת ה־ALU.' : sel === 1 ? 'בוחר בנתון מהזיכרון.' : 'אין בחירה נחוצה בפקודה הזו.'}`,
      calc: `מה יוצא לכיוון Write Data: ${d.controls.RegWrite ? out : 'X — RegWrite=0, לא שומרים באוגר'}.`,
    };
  }
  if (src.includes('branch') || src.includes('zero')) {
    const target = d.name === 'beq' ? '0x00400010' : 'X',
      sel = d.name === 'beq' ? 'Branch AND Zero' : '0';
    return {
      title: 'MUX · Branch / Zero',
      body: `כניסה 0: PC+4=0x00400004. כניסה 1: יעד branch=${target}.`,
      calc: `הבחירה היא ${sel}; ${d.name === 'beq' ? 'ב־beq שבודק שוויון, Branch=1 ו־Zero=1 בוחרים ביעד.' : 'בפקודה הזו אין branch, לכן ממשיכים ב־PC+4.'}`,
    };
  }
  if (src.includes('jump') || src.includes('/ pc')) {
    const target = d.name === 'j' ? '0x00000400' : 'X',
      next = d.name === 'j' ? target : d.name === 'beq' ? '0x00400010' : '0x00400004';
    return {
      title: 'MUX · Jump / PC',
      body: `כניסה רגילה: ${next}. כניסת קפיצה: ${target}. אות Jump=${d.controls.Jump ?? 'X'}.`,
      calc: `הכתובת שיוצאת ל־PC: ${next}. ${d.name === 'j' ? 'נבחר יעד הקפיצה.' : 'נבחר המסלול הרגיל/branch לפי אותות הבחירה.'}`,
    };
  }
  return null;
}
export const muxValueLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
muxValueLayer.setAttribute('class', 'mux-value-layer');
muxValueLayer.setAttribute('aria-hidden', 'true');
diagramSvg.appendChild(muxValueLayer);
export function muxLineData(component, d) {
  const f = instructionBits[d.name] || [],
    bits = (k) => f.find((x) => x[0] === k)?.[1] || 'X',
    rtBits = bits('rt'),
    rdBits = d.name === 'add' ? bits('rd') : bits('immediate') === 'X' ? 'X' : bits('immediate').slice(0, 5),
    rt = rtBits === 'X' ? 'X' : `R${parseInt(rtBits, 2)} (${rtBits})`,
    rd = rdBits === 'X' ? 'X' : `R${parseInt(rdBits, 2)} (${rdBits})`,
    r2 = { add: 5, addi: 0, lw: 42, sw: 42, beq: 7 },
    imm = { addi: 8, lw: 4, sw: 4, beq: 3 },
    alu = { add: 12, addi: 15, lw: 104, sw: 104, beq: 0 },
    mem = { lw: 42 },
    pc4 = '0x00400004',
    branch = d.name === 'beq' ? '0x00400010' : 'X',
    jump = d.name === 'j' ? '0x00000400' : 'X';
  const k = component.toLowerCase();
  if (k === 'regdst') {
    const c = d.controls.RegDst,
      out = c === 0 ? rt : c === 1 ? rd : 'X';
    return [
      { wire: 33, x: 352, y: 258, text: `rt → ${rt}`, selected: c === 0 },
      { wire: 34, x: 350, y: 312, text: `rd/Instr[15:11] → ${rd}`, selected: c === 1 },
      {
        wire: 7,
        x: 445,
        y: 292,
        text: `יציאה → ${d.controls.RegWrite ? out : 'X'}`,
        selected: d.controls.RegWrite === 1,
      },
      { wire: 35, x: 287, y: 334, text: `RegDst=${c ?? 'X'}`, control: true, selected: true },
    ];
  }
  if (k === 'alusrc') {
    const c = d.controls.ALUSrc,
      a = r2[d.name] ?? 'X',
      b = imm[d.name] ?? 'X',
      out = c === 0 ? a : c === 1 ? b : 'X';
    return [
      { wire: 9, x: 445, y: 370, text: `כניסה 0 · RData2=${a}`, selected: c === 0 },
      { wire: 12, x: 448, y: 437, text: `כניסה 1 · SignExt=${b}`, selected: c === 1 },
      { wire: 30, x: 616, y: 390, text: `ALU B ← ${out}`, selected: c === 0 || c === 1 },
      { wire: 31, x: 524, y: 446, text: `ALUSrc=${c ?? 'X'}`, control: true, selected: true },
    ];
  }
  if (k === 'memtoreg') {
    const c = d.controls.MemtoReg,
      a = alu[d.name] ?? 'X',
      b = mem[d.name] ?? 'X',
      out = c === 0 ? a : c === 1 ? b : 'X';
    return [
      { wire: 18, x: 820, y: 480, text: `כניסה 0 · ALU=${a}`, selected: c === 0 },
      { wire: 17, x: 815, y: 535, text: `כניסה 1 · Mem=${b}`, selected: c === 1 },
      {
        wire: 19,
        x: 1005,
        y: 510,
        text: `יציאה → ${d.controls.RegWrite ? out : 'X'}`,
        selected: d.controls.RegWrite === 1,
      },
      { wire: 32, x: 880, y: 558, text: `MemtoReg=${c ?? 'X'}`, control: true, selected: true },
    ];
  }
  if (k.includes('branch')) {
    const c = d.name === 'beq' ? 'Branch·Zero' : '0',
      out = d.name === 'beq' ? branch : pc4;
    return [
      { wire: 26, x: 865, y: 148, text: `כניסה 0 · PC+4=${pc4}`, selected: d.name !== 'beq' },
      { wire: 27, x: 865, y: 207, text: `כניסה 1 · יעד=${branch}`, selected: d.name === 'beq' },
      { wire: 28, x: 1035, y: 170, text: `יציאה → ${out}`, selected: true },
      { wire: 24, x: 935, y: 225, text: `בחירה: ${c}`, control: true, selected: true },
    ];
  }
  if (k.includes('jump')) {
    const c = d.controls.Jump,
      out = d.name === 'j' ? jump : d.name === 'beq' ? branch : pc4,
      normal = d.name === 'beq' ? branch : pc4;
    return [
      { wire: 28, x: 1038, y: 150, text: `כניסה 0 · רגיל=${normal}`, selected: c !== 1 },
      { wire: 21, x: 1095, y: 210, text: `כניסה 1 · יעד J=${jump}`, selected: c === 1 },
      { wire: 29, x: 1175, y: 248, text: `PC הבא → ${out}`, selected: true },
      { wire: null, x: 1148, y: 219, text: `Jump=${c ?? 'X'}`, control: true, selected: true },
    ];
  }
  return [];
}
export function showMuxWireLabels(component) {
  clearMuxWireLabels();
  const d = instructions[state.inst],
    items = muxLineData(component, d);
  for (const item of items) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute(
      'class',
      'mux-wire-value' + (item.control ? ' control' : '') + (item.selected ? ' selected' : ''),
    );
    const width = Math.min(154, Math.max(62, item.text.length * 4.4 + 12));
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', item.x - width / 2);
    rect.setAttribute('y', item.y - 9);
    rect.setAttribute('width', width);
    rect.setAttribute('height', 18);
    rect.setAttribute('rx', 6);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', item.x);
    text.setAttribute('y', item.y + 3);
    text.setAttribute('text-anchor', 'middle');
    text.textContent = item.text;
    g.append(rect, text);
    muxValueLayer.appendChild(g);
    const path = item.wire == null ? null : wirePaths[item.wire];
    path?.classList.add(
      item.control ? 'mux-control-focus' : item.selected ? 'mux-selected-focus' : 'mux-input-focus',
    );
  }
}
export function clearMuxWireLabels() {
  muxValueLayer.replaceChildren();
  wirePaths.forEach((p) => p.classList.remove('mux-selected-focus', 'mux-input-focus', 'mux-control-focus'));
}
export function bindDiagramExplanations() {
  const svg = document.querySelector('.diagram');
  const explainText = (el, evt = null, hoverOnly = false) => {
    const label = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (!label) return;
    const id = el.id || '';
    const d = instructions[state.inst],
      live = liveValues[d.name],
      component = el.parentElement?.querySelector('.block-sub')?.textContent.trim() || label;
    const helpById = {
      'svg-rs': `שדה rs בוחר את האוגר הראשון. כאן ${live.rs}; קוראים את הערך שלו אל Read Data 1.`,
      'svg-rt': `שדה rt בוחר את האוגר השני או יעד הכתיבה. כאן ${live.rt}.`,
      'svg-rdata': `אלה שני הערכים שנקראו מקובץ האוגרים: ${live.data}. הם זמינים לכניסות ה־ALU ולמסלול הזיכרון.`,
      'svg-rd': `RegDst=${d.controls.RegDst} בוחר את כתובת היעד. ${live.rd}.`,
      'svg-wdata': `זהו הערך שחוזר לכתיבה בקובץ האוגרים: ${live.write}.`,
      'svg-imm-value': `המספר המיידי בפקודה הוא ${live.imm}. Sign Extend מתאים את רוחבו לפני שימוש.`,
      'svg-alu-values': `ה־ALU מקבל ${live.alu} ומבצע את הפעולה שבחר ALU Control.`,
      'svg-memory-value': `זיכרון הנתונים: ${live.mem}. רק lw קוראת ממנו ו־sw כותבת אליו.`,
    };
    let body = helpById[id];
    let title = label;
    let calc = 'החץ שמחובר לרכיב מראה לאן הערך ממשיך.';
    if (id === 'svg-instr' || label.toLowerCase().includes('instruction memory')) {
      body = `זיכרון הפקודות מחזיר את קוד המכונה. ב־add זו המילה 0x012A4020 — כתיב הקסדצימלי קצר של 32 ביטים, לא תוצאת חישוב.`;
      calc =
        'opcode 000000 | rs 01001 ($t1) | rt 01010 ($t2) | rd 01000 ($t0) | shamt 00000 | funct 100000 (add).';
    }
    if (/^F[1-6]/.test(label)) {
      const f = label.slice(0, 2);
      title = `${label} · מעקב אחרי החוט`;
      body =
        {
          F1: 'F1 מסמן את כתובת אוגר היעד שמגיעה ל־Write Addr דרך הבורר RegDst.',
          F2: 'F2 הוא Read Data 2: הערך שיצא מהאוגר rt ומגיע לכניסת Write Data של Data Memory.',
          F3: 'F3 מסמן את ה־immediate לפני או אחרי הרחבת הסימן, לפי המיקום בתרשים.',
          F4: 'F4 מסמן נתון שיוצא מקובץ האוגרים ומגיע לכניסת ה־ALU. ב־add, למשל, Read Data 1=7 נכנס לכניסה A.',
          F5: 'F5 מסמן את תוצאת ה־ALU כשהיא משמשת כתובת בזיכרון הנתונים.',
          F6: 'F6 מסמן את מסלול חישוב כתובת ה־branch: מזיזים את ה־offset שמאלה שתי סיביות ומחברים ל־PC+4.',
        }[f] || 'החוט מחבר בין שני רכיבים בתרשים.';
      calc =
        f === 'F2'
          ? `בפקודת ${d.name}: ${live.data}. MemWrite=${d.controls.MemWrite ?? 'X'} קובע אם הערך נשמר בזיכרון.`
          : `בפקודה ${d.name}: ${live.alu}. אפשר לעקוב גם בטבלת כל הפסים שמתחת לשרטוט.`;
    } else if (!body) {
      const t = component.toLowerCase();
      const muxInfo =
        t.includes('mux') ||
        ['regdst', 'alusrc', 'memtoreg'].includes(t) ||
        t.includes('branch / zero') ||
        t.includes('jump / pc')
          ? muxTeaching(component, d, live)
          : null;
      if (muxInfo) {
        title = muxInfo.title;
        body = muxInfo.body;
        calc = muxInfo.calc;
      } else if (t.includes('alu'))
        body = `ה־ALU מבצע את החישוב. הוא מקבל שני אופרנדים ובוחר חיבור, חיסור או השוואה לפי ALU Control. ${live.alu}`;
      else if (t.includes('mux') || t === 'regdst' || t === 'alusrc' || t === 'memtoreg')
        body = `זהו בורר: הוא מקבל כמה אפשרויות ומעביר אחת לפי אות הבחירה.`;
      else if (t.includes('register') || t.includes('אוגר'))
        body = `קובץ האוגרים מכיל 32 אוגרים של 32 ביט. קוראים ממנו ${live.data}; כתובת היעד היא ${live.rd}.`;
      else if (t.includes('memory') || t.includes('זיכרון'))
        body = `זהו זיכרון הנתונים. בפקודה ${d.name} הערך הוא ${live.mem}.`;
      else if (t.includes('sign extend'))
        body = `Sign Extend מרחיב את המספר הקטן שבפקודה ל־32 ביטים. בדוגמה: ${live.imm}.`;
      else if (t.includes('control'))
        body = 'יחידת הבקרה מפענחת את ה־opcode וקובעת את אותות הבקרה שמנתבים את הנתונים.';
      else if (t === 'zero?')
        body = `Zero נדלק כשחיסור ה־ALU נותן 0. ב־beq זה אומר ששני הערכים שווים. עכשיו: ${live.alu}.`;
      else body = `${label} הוא חלק במסלול הנתונים של המעבד. ${live.alu}`;
    }
    if (hoverOnly) showDiagramHover(title, body, calc, evt);
    else openInfo(title, body, calc);
  };
  svg.querySelectorAll('text').forEach((el) => {
    el.addEventListener('click', () => explainText(el));
    el.addEventListener('mouseenter', (e) => {
      state.infoPinned = false;
      explainText(el, e, true);
    });
    el.addEventListener('mousemove', (e) => {
      if (!state.infoPinned) explainText(el, e, true);
    });
    el.addEventListener('mouseleave', hideDiagramHover);
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `הסבר: ${(el.textContent || '').trim()}`);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        explainText(el);
      }
    });
  });
  svg.querySelectorAll('g.unit').forEach((g) => {
    const title = g.querySelector('.block-title'),
      subtitle = g.querySelector('.block-sub')?.textContent.trim() || '';
    if (['RegDst', 'ALUSrc', 'MemtoReg', 'Branch / Zero', 'Jump / PC'].includes(subtitle)) {
      g.addEventListener('mouseenter', () => showMuxWireLabels(subtitle));
      g.addEventListener('focusin', () => showMuxWireLabels(subtitle));
      g.addEventListener('mouseleave', clearMuxWireLabels);
      g.addEventListener('focusout', clearMuxWireLabels);
    }
    if (title) return;
    g.addEventListener('click', () => {
      const name = g.dataset.unit || 'רכיב';
      openInfo(
        name,
        `הרכיב הזה משתתף בשלב ${stageHeb[activeStep()[2]] || 'העיבוד'}. עקבי אחרי החצים הירוקים כדי לראות את הערך שנכנס ואת הערך שיוצא.`,
        `בפקודה ${d.name} הערכים הרלוונטיים: ${live.data} · ${live.alu}`,
      );
    });
  });
}

export function showSignalInfo(k) {
  const d = instructions[state.inst],
    v = d.controls[k] ?? 'X',
    g = signalLessons[k],
    why = d.why[k] || 'האות לא משפיע על הפקודה הזו.';
  openInfo(`קו בקרה ${k} = ${v} · ${g[0]}`, g[1], `${g[2]} בפקודת ${d.name}: ${why}`);
}
export function showEncodingInfo(field, value) {
  const help = {
    opcode: 'מזהה את משפחת הפקודה. יחידת הבקרה קוראת אותו וקובעת את אותות הבקרה.',
    rs: 'מספר האוגר הראשון שקוראים. למשל 01001 הוא 9, כלומר R9 או $t1.',
    rt: 'מספר האוגר השני או אוגר היעד, לפי סוג הפקודה.',
    rd: 'אוגר היעד בפקודת R-type, כשהתוצאה חוזרת מקובץ האוגרים.',
    shamt: 'כמה מקומות להזיז בפקודות shift. ב־add הערך 00000 כי אין הזזה.',
    funct: 'בפקודת R-type קובע את הפעולה המדויקת של ה־ALU. ב־add הקוד 100000 פירושו חיבור.',
    immediate: 'מספר קטן שמופיע בתוך הפקודה. מרחיבים אותו ל־32 ביטים לפני שימוש ב־ALU.',
    target: 'שדה כתובת הקפיצה. מזיזים אותו שמאלה שתי סיביות ומחברים לחלק העליון של PC+4.',
  };
  openInfo(
    `שדה קידוד ${field}: ${value}`,
    help[field] || 'חלק מהפקודה המקודדת.',
    `המעבד לא קורא את הפקודה כמילים; הוא מפענח את הביטים האלה.`,
  );
}
updateRouteLabels(instructions[state.inst].name, activeStep()[2]);

export function packetPlan(name, stage) {
  const plans = {
    fetch: [
      [0, 'PC'],
      [1, 'פקודה'],
      [3, 'PC+4'],
    ],
    decode: [
      [4, 'rs'],
      [5, 'rt'],
      [6, 'RegWrite'],
      [7, 'יעד'],
      [31, 'ALUSrc'],
      [33, 'rt'],
      [34, 'rd'],
      [35, 'RegDst'],
    ],
    read: [
      [8, { add: '7', addi: '7', lw: '100', sw: '100', beq: '7', j: '—' }[name]],
      [9, { add: '5', addi: 'R8=0', lw: 'R8=42', sw: 'R8=42', beq: '7', j: '—' }[name]],
    ],
    extend:
      name === 'beq'
        ? [
            [11, 'offset=3'],
            [13, '3<<2=12'],
            [25, '12 ליעד'],
          ]
        : [
            [11, { addi: '8', lw: '4', sw: '4' }[name] || 'imm'],
            [12, { addi: '8→32b', lw: '4→32b', sw: '4→32b' }[name] || 'imm→32b'],
          ],
    alu:
      name === 'add'
        ? [
            [8, 'A=7'],
            [9, 'B=5'],
            [30, 'B=5'],
            [15, '12'],
          ]
        : name === 'addi'
          ? [
              [8, 'A=7'],
              [12, 'B=8'],
              [30, 'B=8'],
              [15, '15'],
            ]
          : name === 'lw'
            ? [
                [8, 'A=100'],
                [12, 'B=4'],
                [30, 'B=4'],
                [15, '104'],
              ]
            : name === 'sw'
              ? [
                  [8, 'A=100'],
                  [12, 'B=4'],
                  [30, 'B=4'],
                  [15, '104'],
                ]
              : name === 'beq'
                ? [
                    [8, 'A=7'],
                    [9, 'B=7'],
                    [30, 'B=7'],
                    [15, '0'],
                  ]
                : [],
    mem:
      name === 'lw'
        ? [
            [15, 'כתובת 104'],
            [16, '42'],
            [17, '42→אוגר'],
          ]
        : name === 'sw'
          ? [
              [10, '42 → M[104]'],
              [15, 'כתובת 104'],
            ]
          : [],
    writeback:
      name === 'add'
        ? [
            [18, '12'],
            [19, '12→R8'],
            [32, 'MemtoReg=0'],
          ]
        : name === 'addi'
          ? [
              [18, '15'],
              [19, '15→R8'],
              [32, 'MemtoReg=0'],
            ]
          : name === 'lw'
            ? [
                [17, '42'],
                [19, '42→R8'],
                [32, 'MemtoReg=1'],
              ]
            : [],
    branch: [
      [22, 'Branch=1'],
      [23, 'Zero=1'],
      [24, 'AND=1'],
      [25, 'offset=12'],
      [26, 'PC+4[31:28]=0'],
      [27, 'יעד 0x10'],
      [28, 'PCSrc=1'],
      [29, 'PC חדש'],
    ],
    jump: [
      [20, 'target'],
      [21, '0x400'],
      [29, 'PC חדש'],
      [31, 'ALUSrc=0'],
    ],
  };
  return plans[stage] || [];
}
export function updateMovieReadout(d, s) {
  const trace =
    flowTrace[d.name].find((r) => r[0] === s[2]) || flowTrace[d.name][flowTrace[d.name].length - 1];
  document.getElementById('movie-stage').textContent = `${state.step + 1}/${d.steps.length} · ${s[0]}`;
  document.getElementById('movie-route').textContent = trace[2];
  document.getElementById('movie-values').textContent = trace[3];
  document.getElementById('movie-control').textContent = trace[4];
  document
    .getElementById('movie-stage')
    .setAttribute('aria-label', `שלב ${state.step + 1} מתוך ${d.steps.length}`);
}
export function animateStage(name, stage) {
  const ns = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('.moving-token').forEach((x) => x.remove());
  const active = activeWireIds(name, stage);
  wirePaths.forEach((p, i) => {
    p.classList.remove('hot', 'alt');
    p.setAttribute('marker-end', active.includes(i) ? 'url(#arrow-hot)' : 'url(#arrow)');
    if (active.includes(i)) {
      p.classList.add('hot');
      if (['extend', 'mem', 'branch', 'jump'].includes(stage)) p.classList.add('alt');
    }
  });
  packetPlan(name, stage).forEach(([wire, label], i) => {
    const path = wirePaths[wire];
    if (!path) return;
    const g = document.createElementNS(ns, 'g');
    g.setAttribute(
      'class',
      'moving-token' + (['extend', 'mem', 'branch', 'jump'].includes(stage) ? ' alt' : ''),
    );
    g.setAttribute('aria-label', `הערך ${label} זז על הפס`);
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('r', '5');
    const motion = document.createElementNS(ns, 'animateMotion');
    motion.setAttribute('dur', '1.8s');
    motion.setAttribute('begin', `${i * 0.18}s`);
    motion.setAttribute('repeatCount', 'indefinite');
    motion.setAttribute('rotate', 'auto');
    motion.setAttribute('path', path.getAttribute('d'));
    g.append(dot, motion);
    diagramSvg.appendChild(g);
  });
}
export function updateFWireLabels() {
  const name = instructions[state.inst].name;
  const values = {
    add: [
      'F1: WriteAddr=R8',
      'F2: R10=5 · MemWrite=0',
      'F3: imm=0x4020',
      'F4: R9=7',
      'F5: Address=12',
      'F6: 0x00410084',
    ],
    addi: [
      'F1: WriteAddr=R8',
      'F2: R8=0 · MemWrite=0',
      'F3: imm=8',
      'F4: R9=7',
      'F5: Address=15',
      'F6: 0x00400024',
    ],
    lw: [
      'F1: WriteAddr=R8',
      'F2: X · MemWrite=0',
      'F3: imm=4',
      'F4: R9=100',
      'F5: Address=104',
      'F6: 0x00400014',
    ],
    sw: [
      'F1: X · RegWrite=0',
      'F2: R8=42 · MemWrite=1',
      'F3: imm=4',
      'F4: R9=100',
      'F5: Address=104',
      'F6: 0x00400014',
    ],
    beq: [
      'F1: X · RegWrite=0',
      'F2: R9=7 · MemWrite=0',
      'F3: offset=3',
      'F4: R8=7',
      'F5: Address=0',
      'F6: 0x00400010',
    ],
    j: [
      'F1: X · RegWrite=0',
      'F2: X · MemWrite=0',
      'F3: field=0x0100',
      'F4: ALU לא בשימוש',
      'F5: ALU לא בשימוש',
      'F6: לא בשימוש',
    ],
  }[name];
  values.forEach((label, i) => {
    const el = document.getElementById(`svg-f${i + 1}-tag`);
    if (!el) return;
    el.textContent = label;
    el.style.fontSize = label.length > 18 ? '6px' : '7px';
    const rect = el.id === 'svg-f6-tag' ? document.getElementById('svg-f6-bg') : el.previousElementSibling;
    if (rect?.tagName.toLowerCase() === 'rect') {
      const width = Math.max(68, label.length * 4.2 + 14),
        cx = Number(el.getAttribute('x'));
      rect.setAttribute('x', cx - width / 2);
      rect.setAttribute('width', width);
    }
  });
}
export function render() {
  const d = instructions[state.inst],
    s = activeStep();
  renderControlTable();
  renderWireValues();
  updateRouteLabels(d.name, s[2]);
  updateControlValueBadges();
  updateFWireLabels();
  updateMovieReadout(d, s);
  document.getElementById('diagram-explanation-title').textContent = `${d.name.toUpperCase()} · ${s[0]}`;
  document.getElementById('diagram-explanation-text').textContent = s[1];
  const explanationTrace = flowTrace[d.name].find((r) => r[0] === s[2]) || flowTrace[d.name][0];
  document.getElementById('diagram-explanation-values').innerHTML =
    `<strong>הנתונים והבקרה בשלב:</strong> ${explanationTrace[2]} · ${explanationTrace[3]} · קווי בקרה: ${explanationTrace[4]}`;
  document.getElementById('instruction-picker').innerHTML = instructions
    .map(
      (x, i) =>
        `<button class="instruction-choice ${i === state.inst ? 'active' : ''}" data-select="${i}" aria-pressed="${i === state.inst}">${x.name}</button>`,
    )
    .join('');
  document.querySelectorAll('[data-select]').forEach(
    (b) =>
      (b.onclick = () => {
        setInst(+b.dataset.select);
        setMode('manual');
      }),
  );
  document.getElementById('inst-index').textContent = state.inst + 1;
  document.getElementById('inst-label').textContent = d.name;
  document.getElementById('instruction').querySelector('span').textContent = d.syntax;
  const bits = instructionBits[d.name];
  document.getElementById('encoding-display').innerHTML = bits
    .map(
      (f, i) =>
        `<span class="encoding-field ${i === 0 ? 'opcode' : ['rs', 'rt', 'rd'].includes(f[0]) ? 'reg' : f[0] === 'immediate' ? 'imm' : ''}"><label>${f[0]}</label><code>${f[1]}</code></span>`,
    )
    .join('');
  document.querySelectorAll('.encoding-field').forEach((el, i) => {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.onclick = () => showEncodingInfo(bits[i][0], bits[i][1]);
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showEncodingInfo(bits[i][0], bits[i][1]);
      }
    };
  });
  const live = liveValues[d.name];
  for (const [id, key] of [
    ['svg-rs', 'rs'],
    ['svg-rt', 'rt'],
    ['svg-rdata', 'data'],
    ['svg-rd', 'rd'],
    ['svg-wdata', 'write'],
    ['svg-imm-value', 'imm'],
    ['svg-alu-values', 'alu'],
    ['svg-memory-value', 'mem'],
  ])
    document.getElementById(id).textContent = String(live[key]).replace(
      /([\u0590-\u05FF])(\s*[=:])/g,
      '$1\u200E$2',
    );
  document.getElementById('mux-input-0').classList.toggle('selected', d.controls.ALUSrc === 0);
  document.getElementById('mux-input-1').classList.toggle('selected', d.controls.ALUSrc === 1);
  document.getElementById('step-title').textContent = s[0];
  document.getElementById('step-desc').textContent = s[1];
  document.getElementById('progress').style.width = ((state.step + 1) / d.steps.length) * 100 + '%';
  document.getElementById('prev').disabled = state.step === 0;
  document.getElementById('next').textContent =
    state.step === d.steps.length - 1 ? 'סיימנו — פקודה הבאה ←' : 'השלב הבא ←';
  document.getElementById('nextInst').textContent =
    'הפקודה הבאה: ' + instructions[(state.inst + 1) % instructions.length].name + ' ⟵';
  document.getElementById('analogy').innerHTML = '<b>דמיינו:</b> ' + analogyFor(d.name, state.step);
  document.getElementById('control-tag').textContent = d.tag;
  document.getElementById('opcode-tag').textContent = 'Opcode ' + d.opcode;
  document.getElementById('alu-explain').innerHTML =
    ({
      add: 'R-type · funct של add בוחר חיבור: <code>0010</code>.',
      addi: 'ALUOp=00: חיבור בין אוגר למספר המיידי: <code>0010</code>.',
      lw: 'ALUOp=00: ה־ALU מחבר בסיס והיסט לכתובת: <code>0010</code>.',
      sw: 'ALUOp=00: ה־ALU מחבר בסיס והיסט לכתובת: <code>0010</code>.',
      beq: 'ALUOp=01: ה־ALU מחסר כדי לבדוק שוויון: <code>0110</code>.',
      j: 'פקודת J לא משתמשת ב־ALU Control; Jump בוחר את כתובת היעד.',
    }[d.name] || 'R-type: קוד funct קובע את הפעולה.') +
    (d.name === 'add'
      ? ' <span style="color:var(--muted)">R-type sub משתמש ב־<code>0110</code>; AND ב־<code>0000</code>; OR ב־<code>0001</code>.</span>'
      : '');
  document.getElementById('read-values').innerHTML = d.read;
  document.getElementById('result-values').innerHTML = d.result;
  document.getElementById('dataflow').innerHTML = flowTrace[d.name]
    .map(
      (r) =>
        `<div class="trace-row ${r[0] === s[2] ? 'active' : ''}"><div class="trace-icon">${r[0] === s[2] ? '●' : '○'}</div><div class="trace-main"><div class="trace-head"><b>${r[1]}</b><span>${stageHeb[r[0]]}</span></div><div class="trace-wire">${r[2]}</div><div class="trace-value">${r[3]}</div><div class="trace-control">קווי בקרה: ${r[4]}</div></div></div>`,
    )
    .join('');
  document.getElementById('signal-body').innerHTML = keys
    .map((k) => {
      const v = d.controls[k] ?? 'X',
        reason =
          d.why[k] ||
          {
            ALUOp1: 'הביט העליון בוחר יחד עם ALUOp0 את סוג החישוב.',
            ALUOp0: 'שני ביטי ALUOp אומרים ל־ALU Control איזו פעולה להכין.',
            Jump: 'האות קובע אם כתובת הקפיצה תגיע ל־PC.',
          }[k] ||
          'הקו לא משנה בפקודה הזו.';
      return `<tr><td><button class="signal-name-btn" data-signal="${k}">${k}</button></td><td style="color:var(--muted)">${reason.split('—')[0].split('.')[0]}</td><td class="signal-val ${v === 1 ? 'on' : ''}" data-signal="${k}" role="button" tabindex="0">${v}</td></tr>`;
    })
    .join('');
  document.querySelectorAll('[data-signal]').forEach((b) => {
    b.onclick = () => showSignalInfo(b.dataset.signal);
    b.onmouseenter = (e) => {
      state.infoPinned = false;
      const k = b.dataset.signal,
        d = instructions[state.inst],
        g = signalLessons[k];
      showDiagramHover(
        `${k} = ${d.controls[k] ?? 'X'}`,
        g?.[1] || 'אות בקרה קובע בחירה במסלול.',
        `${g?.[2] || ''} בפקודת ${d.name}: ${d.why[k] || ''}`,
        e,
      );
    };
    b.onmousemove = (e) => {
      if (!state.infoPinned) {
        const k = b.dataset.signal,
          d = instructions[state.inst],
          g = signalLessons[k];
        showDiagramHover(
          `${k} = ${d.controls[k] ?? 'X'}`,
          g?.[1] || 'אות בקרה קובע בחירה במסלול.',
          `${g?.[2] || ''} בפקודת ${d.name}: ${d.why[k] || ''}`,
          e,
        );
      }
    };
    b.onmouseleave = hideDiagramHover;
    b.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showSignalInfo(b.dataset.signal);
      }
    };
  });
  document.getElementById('signal-why').innerHTML =
    '<p class="signal-key-note">1 = האות פעיל · 0 = לא פעיל · X = הערך לא משפיע בפקודה הזו. לחצי על שם או ערך של קו בקרה להסבר.</p><strong>למה דווקא הערכים האלה?</strong><ul>' +
    keys
      .map(
        (k) =>
          `<li><code>${k} = ${d.controls[k] ?? 'X'}</code> — ${d.why[k] || { ALUOp1: 'הביט העליון בקוד ALUOp בוחר יחד עם הביט התחתון את סוג הפעולה.', ALUOp0: 'הביט התחתון בקוד ALUOp משלים את בחירת הפעולה ל־ALU Control.', Jump: 'האות קובע אם הכתובת שמגיעה ל־PC היא כתובת קפיצה ישירה.' }[k] || 'הקו לא משנה במסלול של הפקודה הזו.'}</li>`,
      )
      .join('') +
    '</ul>';
  document.querySelectorAll('.unit').forEach((x) => {
    x.classList.remove('hot', 'alt');
    if (x.dataset.unit.split(',').includes(s[2]))
      x.classList.add(['extend', 'mem', 'branch', 'jump'].includes(s[2]) ? 'alt' : 'hot');
  });
  animateStage(d.name, s[2]);
  document.getElementById('stage').classList.toggle('auto', state.mode === 'auto');
}
export function analogyFor(name, n) {
  let a = {
    j: [
      'הפקודה נשלפת מזיכרון הפקודות לפי PC.',
      'יחידת הבקרה מזהה opcode של j ומעלה Jump=1.',
      'כתובת היעד נבנית מ־26 הביטים של הפקודה ומ־4 הביטים העליונים של PC+4.',
      'בורר ה־PC בוחר את כתובת הקפיצה.',
      'במחזור הבא הביצוע ממשיך מכתובת היעד.',
    ],
    add: [
      'הפקודה נשלפת מזיכרון הפקודות לפי PC.',
      'קובץ האוגרים קורא את rs ואת rt.',
      'שני הערכים מגיעים לכניסות ה־ALU.',
      'ה־ALU מחבר את שני האופרנדים.',
      'התוצאה נכתבת לאוגר rd.',
    ],
    addi: [
      'הפקודה נשלפת מזיכרון הפקודות לפי PC.',
      'קובץ האוגרים קורא את rs.',
      'הקבוע בן 16 הביטים מורחב עם סימן ל־32 ביט.',
      'ה־ALU מחבר את rs ואת הקבוע (ALUSrc=1).',
      'התוצאה נכתבת לאוגר rt.',
    ],
    lw: [
      'הפקודה נשלפת מזיכרון הפקודות לפי PC.',
      'קובץ האוגרים קורא את כתובת הבסיס מ־rs.',
      'ההיסט מורחב עם סימן ל־32 ביט.',
      'ה־ALU מחשב כתובת = בסיס + היסט.',
      'זיכרון הנתונים קורא את המילה בכתובת (MemRead=1).',
      'הערך שנקרא נכתב לאוגר rt (MemtoReg=1).',
    ],
    sw: [
      'הפקודה נשלפת מזיכרון הפקודות לפי PC.',
      'קובץ האוגרים קורא את הבסיס מ־rs ואת הנתון מ־rt.',
      'ההיסט מורחב עם סימן ל־32 ביט.',
      'ה־ALU מחשב כתובת = בסיס + היסט.',
      'הערך של rt נכתב לזיכרון הנתונים (MemWrite=1).',
    ],
    beq: [
      'הפקודה נשלפת מזיכרון הפקודות לפי PC.',
      'קובץ האוגרים קורא את rs ואת rt.',
      'ה־ALU מחסר את הערכים ובודק אם התוצאה אפס (Zero).',
      'אם Branch=1 וגם Zero=1, הבורר בוחר את כתובת הענף.',
      'ה־PC הבא הוא PC+4 או כתובת הענף, לפי תוצאת ההשוואה.',
    ],
  }[name] || ['הפקודה מתקדמת בין שלבי המעבד.'];
  return a[Math.min(n, a.length - 1)];
}
export function setInst(n) {
  state.inst = (n + instructions.length) % instructions.length;
  state.step = 0;
  render();
}
export function next() {
  if (state.step < instructions[state.inst].steps.length - 1) {
    state.step++;
    render();
  } else setInst(state.inst + 1);
}
