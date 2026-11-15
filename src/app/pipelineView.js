// Pipeline view: five-stage diagram, cycle timeline, hazard demos.
import { pipelineRoutePositions, pipelineRouteStages, pipelineStageXs } from '../diagrams/layout/pipeline.js';
import { instructions, liveValues } from '../domain/instructions.js';
import { pipeSequences, pipeStageNames, pipeTrace } from '../domain/pipeline.js';
import { routeInfo } from '../domain/singleCycle.js';
import { state, timers } from './context.js';

const setText = (id, text) => {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
};

export function renderSequence() {
  const s = pipeSequences[state.sequenceIndex],
    cycles = Math.max(...s.schedule.map((r) => r.length));
  document.getElementById('sequence-picker').innerHTML = pipeSequences
    .map(
      (x, i) =>
        `<button class="sequence-btn ${i === state.sequenceIndex ? 'active' : ''}" data-sequence="${i}">${x.title}</button>`,
    )
    .join('');
  document.querySelectorAll('[data-sequence]').forEach(
    (b) =>
      (b.onclick = () => {
        state.sequenceIndex = +b.dataset.sequence;
        state.sequenceCycle = 1;
        renderSequence();
      }),
  );
  document.getElementById('sequence-explain').innerHTML =
    `<strong>${s.title}</strong><br>${s.desc}<br>${state.sequenceIndex === 0 ? 'במחזור 4: ForwardA=10, EX/MEM.ALUResult=12 → ALU A של sub.' : state.sequenceIndex === 1 ? 'במחזור 4: PCWrite=0 · IF/IDWrite=0 · ID/EX.Flush=1. במחזור 5: ForwardA=01 מביא את ReadData=42 מ־MEM/WB.' : 'Branch=1 יחד עם Zero=1 בוחר את יעד הקפיצה; הפקודה הצעירה מבוטלת ולא תכתוב אוגר.'}`;
  let h =
    '<table class="sequence-table"><thead><tr><th>פקודה</th>' +
    Array.from({ length: cycles }, (_, i) => `<th>מחזור ${i + 1}</th>`).join('') +
    '</tr></thead><tbody>';
  s.instructions.forEach((ins, row) => {
    h += `<tr><th>${ins}</th>`;
    for (let col = 0; col < cycles; col++) {
      let v = s.schedule[row][col] || '·',
        c = '';
      if (v.startsWith('IF')) c = 'stage-if';
      else if (v.startsWith('ID')) c = 'stage-id';
      else if (v === 'EX') c = 'stage-ex';
      else if (v === 'MEM') c = 'stage-mem';
      else if (v === 'WB') c = 'stage-wb';
      if (v.includes('המתנה') || v.includes('קפוא')) c = 'stalled';
      if (s.bubbles?.some((x) => x.row === row && x.col === col)) {
        c = 'bubble';
        v = s.bubbles.find((x) => x.row === row && x.col === col).label;
      }
      if (v === 'FLUSH' || s.flushes?.some((x) => x.row === row && x.col === col)) {
        c = 'flushed';
        v = 'Flush · בוטלה';
      }
      if (col === state.sequenceCycle - 1) c += ' active-cycle';
      h += `<td class="${c}">${v}</td>`;
    }
    h += '</tr>';
  });
  s.bubbles?.forEach((b) => {
    h += '<tr><th>בועה · NOP</th>';
    for (let col = 0; col < cycles; col++)
      h += `<td class="${col + 1 === b.cycle ? 'bubble' : ''}">${col + 1 === b.cycle ? b.label : '·'}</td>`;
    h += '</tr>';
  });
  document.getElementById('sequence-table').innerHTML = h + '</tbody></table>';
  document.getElementById('sequence-cycle-label').textContent = `מחזור ${state.sequenceCycle} מתוך ${cycles}`;
  document.getElementById('sequence-prev').disabled = state.sequenceCycle <= 1;
  document.getElementById('sequence-next').disabled = state.sequenceCycle >= cycles;
  document.getElementById('sequence-prev').onclick = () => {
    state.sequenceCycle = Math.max(1, state.sequenceCycle - 1);
    renderSequence();
  };
  document.getElementById('sequence-next').onclick = () => {
    state.sequenceCycle = Math.min(cycles, state.sequenceCycle + 1);
    renderSequence();
  };
  renderPipeCycleTimeline();
}
export function renderPipeCycleTimeline() {
  const host = document.getElementById('pipe-cycle-timeline');
  if (!host) return;
  const s = pipeSequences[state.sequenceIndex],
    cycles = Math.max(...s.schedule.map((r) => r.length)),
    col = Math.max(0, Math.min(cycles - 1, state.sequenceCycle - 1)),
    stages = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  let rows =
    '<table class="pipe-cycle-table"><thead><tr><th>פקודה</th>' +
    Array.from({ length: cycles }, (_, i) => `<th class="${i === col ? 'now' : ''}">${i + 1}</th>`).join('') +
    '</tr></thead><tbody>';
  const jobs = [];
  s.instructions.forEach((ins, row) => {
    rows += `<tr><th>${ins}</th>`;
    for (let i = 0; i < cycles; i++) {
      const value = s.schedule[row][i] || '·';
      const stage = stages.find((x) => value.startsWith(x));
      const bubble = s.bubbles?.some((b) => b.row === row && b.col === i);
      const stalled = value.includes('המתנה') || value.includes('קפוא');
      const flushed = value === 'FLUSH' || s.flushes?.some((f) => f.row === row && f.col === i);
      const cls = [
        stage ? 'stage-' + stage.toLowerCase() : '',
        bubble ? 'bubble' : '',
        stalled ? 'stalled' : '',
        flushed ? 'flushed' : '',
        i === col ? 'current' : '',
      ]
        .filter(Boolean)
        .join(' ');
      rows += `<td class="${cls}">${bubble ? 'בועה' : flushed ? 'Flush' : value}</td>`;
      if (i === col && stage) {
        const op = ins.trim().split(/\s+/)[0].toLowerCase(),
          detail = bubble
            ? 'המתנה · ID/EX.Flush מכניס בועה'
            : value.includes('קפוא')
              ? 'הפקודה ממתינה · PCWrite=0, IF/IDWrite=0'
              : stage === 'IF'
                ? 'שליפת פקודה וזיכרון הוראות'
                : stage === 'ID'
                  ? 'פענוח וקריאת אוגרים'
                  : stage === 'EX'
                    ? op === 'lw' || op === 'sw'
                      ? 'חישוב כתובת בעזרת ALU'
                      : op === 'beq' || op === 'bne'
                        ? 'השוואת אוגרים והחלטת ענף'
                        : 'ביצוע פעולת ALU'
                    : stage === 'MEM'
                      ? op === 'lw'
                        ? 'קריאת נתון מהזיכרון'
                        : op === 'sw'
                          ? 'כתיבת נתון לזיכרון'
                          : 'העברת תוצאה הלאה'
                      : stage === 'WB'
                        ? op === 'sw' || op === 'beq' || op === 'bne' || op === 'j'
                          ? 'אין כתיבה לאוגר'
                          : 'כתיבת תוצאה לאוגר היעד'
                        : 'המתנה';
        jobs.push(`${stage}: ${ins} — ${detail}`);
      }
    }
    rows += '</tr>';
  });
  s.bubbles?.forEach((b) => {
    rows += '<tr><th>בועה · NOP</th>';
    for (let i = 0; i < cycles; i++)
      rows += `<td class="${i + 1 === b.cycle ? 'bubble' : ''} ${i === col ? 'current' : ''}">${i + 1 === b.cycle ? b.label : '·'}</td>`;
    rows += '</tr>';
  });
  rows += '</tbody></table>';
  const cycleNumber = state.sequenceCycle,
    info = jobs.length ? jobs.join('　·　') : 'במחזור הזה אין פעולה פעילה ברצף';
  host.innerHTML = `<div class="pipe-cycle-head"><div><b>פעולות לפי מחזור שעון</b><small>${s.title} · ${s.desc}</small></div><div class="pipe-cycle-buttons"><button type="button" class="btn" data-cycle-shift="-1" ${cycleNumber <= 1 ? 'disabled' : ''}>מחזור קודם</button><strong>מחזור ${cycleNumber} / ${cycles}</strong><button type="button" class="btn primary" data-cycle-shift="1" ${cycleNumber >= cycles ? 'disabled' : ''}>המחזור הבא ←</button></div></div><div class="pipe-cycle-picker">${pipeSequences.map((item, index) => `<button type="button" class="sequence-btn ${index === state.sequenceIndex ? 'active' : ''}" data-cycle-seq="${index}">${item.title}</button>`).join('')}</div><div class="pipe-cycle-scroll">${rows}</div><div class="pipe-cycle-jobs"><b>מה קורה עכשיו:</b> ${info}</div>`;
  host.querySelectorAll('[data-cycle-seq]').forEach(
    (button) =>
      (button.onclick = () => {
        state.sequenceIndex = Number(button.dataset.cycleSeq);
        state.sequenceCycle = 1;
        renderSequence();
        renderPipeline();
      }),
  );
  host.querySelectorAll('[data-cycle-shift]').forEach(
    (button) =>
      (button.onclick = () => {
        state.sequenceCycle = Math.max(
          1,
          Math.min(cycles, state.sequenceCycle + Number(button.dataset.cycleShift)),
        );
        const column = state.sequenceCycle - 1;
        let focus = null;
        for (let row = 0; row < s.instructions.length && !focus; row++) {
          const value = s.schedule[row][column] || '',
            stage = stages.find((x) => value.startsWith(x));
          if (stage) {
            const name = (s.instructions[row].match(/^(add|sub|and|or|slt|addi|lw|sw|beq|bne|j|nop)\b/i) ||
                [])[1]?.toLowerCase(),
              idx = instructions.findIndex((item) => item.name === name);
            if (idx >= 0) focus = { idx, stage };
          }
        }
        if (focus) {
          state.pipeInst = focus.idx;
          state.pipeStep = stages.indexOf(focus.stage);
        }
        renderSequence();
        renderPipeline();
      }),
  );
}
export function pipeWireDetail(index, signal) {
  const d = instructions[state.pipeInst],
    n = d.name,
    c = d.controls;
  const controlDetail = {
    bundle: [
      'חבילת אותות הבקרה',
      'EX: RegDst / ALUSrc / ALUOp · MEM: Branch / MemRead / MemWrite · WB: RegWrite / MemtoReg',
      'אותות הבקרה נוצרים בפענוח, נשמרים ברגיסטרי הביניים, ומופעלים בתחנה המתאימה לאותה פקודה.',
    ],
    EX: [
      'ID/EX → EX · אותות ביצוע',
      `RegDst=${c.RegDst ?? 'X'} · ALUSrc=${c.ALUSrc ?? 'X'} · ALUOp=${c.ALUOp1 ?? 'X'}${c.ALUOp0 ?? 'X'} · FwdA=${state.hazardDemo === 'alu' ? '10' : state.hazardDemo === 'load' ? '01' : '00'}`,
      'RegDst בוחר אוגר יעד; ALUSrc בוחר אוגר או immediate; ALUOp קובע את סוג החישוב. ForwardA/B בוחרים אם לעקוף ערך חדש.',
    ],
    MEM: [
      'EX/MEM → MEM · אותות זיכרון וענף',
      `Branch=${c.Branch ?? 'X'} · MemRead=${c.MemRead ?? 'X'} · MemWrite=${c.MemWrite ?? 'X'}`,
      'MemRead מפעיל קריאת נתונים; MemWrite שומר נתון; Branch משתתף בהחלטה אם לשנות את ה־PC.',
    ],
    WB: [
      'MEM/WB → WB · אותות כתיבה חזרה',
      `RegWrite=${c.RegWrite ?? 'X'} · MemtoReg=${c.MemtoReg ?? 'X'}`,
      'MemtoReg בוחר תוצאת ALU או נתון מהזיכרון. RegWrite מאשר כתיבה לקובץ האוגרים.',
    ],
    Hazard: [
      'Hazard Unit → עצירה ו־Flush',
      `PCWrite=${state.hazardDemo === 'load' ? 0 : 1} · IF/IDWrite=${state.hazardDemo === 'load' ? 0 : 1} · IF.Flush=${state.hazardDemo === 'control' ? 1 : 0} · ID.Flush/EX.Flush לפי הסיכון`,
      'בתלות lw-use עוצרים את ה־PC ואת IF/ID ומכניסים NOP ל־ID/EX. ב־branch שנלקח מנקים פקודות צעירות לפי מקום הכרעת הענף.',
    ],
    Exception: [
      'Exception · Cause ו־EPC',
      'Cause=— · EPC=— · Exception=0',
      'בתרחישי הלימוד אין חריגה. Cause יציין את סיבת החריגה ו־EPC ישמור את כתובת הפקודה שגרמה לה.',
    ],
  }[signal];
  if (controlDetail) return controlDetail;
  const rs = { add: 'R9=7', addi: 'R9=7', lw: 'R9=100', sw: 'R9=100', beq: 'R8=7', j: 'לא נקרא' }[n],
    rt = { add: 'R10=5', addi: 'R8=0', lw: 'R8=X', sw: 'R8=42', beq: 'R9=7', j: 'לא נקרא' }[n],
    alu = { add: '12', addi: '15', lw: '104', sw: '104', beq: '7−7=0 · Zero=1', j: 'לא בשימוש' }[n],
    mem = n === 'lw' ? 'M[104]=42' : n === 'sw' ? 'MemWrite=1 · M[104]←42' : 'הזיכרון לא מופעל',
    wb = n === 'add' ? '12 → R8' : n === 'addi' ? '15 → R8' : n === 'lw' ? '42 → R8' : 'אין כתיבה לאוגר',
    imm = {
      add: '—',
      addi: 'SignExt(8)=8',
      lw: 'SignExt(4)=4',
      sw: 'SignExt(4)=4',
      beq: 'SignExt(3)=3',
      j: 'יעד=0x100',
    }[n],
    fa =
      state.hazardDemo === 'alu'
        ? 'ForwardA=10 · תוצאה קודמת=12'
        : state.hazardDemo === 'load'
          ? 'ForwardA=01 · ReadData=42'
          : 'ForwardA=00 · ' + rs,
    fb = state.hazardDemo === 'load' ? 'ForwardB=01 · נתון שמור=42' : 'ForwardB=00 · ' + rt;
  const a = [
    ['PC → Instruction Memory', 'PC=0x00400000', 'ה־PC נותן את כתובת ההוראה שאותה זיכרון הפקודות קורא.'],
    [
      'Instruction Memory → IF/ID',
      routeInfo[n][1].match(/0x[\da-f]+/i)?.[0] || 'קידוד הפקודה',
      'הפקודה וקידוד 32 הביטים נשמרים ב־IF/ID.',
    ],
    [
      'שדות rs ו־rt → Register File',
      rs + ' · ' + rt,
      'החוטים נושאים מספרי אוגרים מתוך הפקודה; קובץ האוגרים משתמש בהם כדי לבחור אילו אוגרים לקרוא ולכתוב.',
    ],
    ['Read Data 1/2 → ID/EX', rs + ' · ' + rt, 'הערכים שנקראו נשמרים ברגיסטר ID/EX עד שלב EX.'],
    ['Sign Extend → ID/EX', imm, 'המספר המיידי מורחב ל־32 ביט ונשמר יחד עם שאר נתוני הפקודה.'],
    ['ID/EX → Forwarding MUX A', rs, 'האופרנד הראשון המקורי מגיע מהאוגר rs.'],
    ['ID/EX → Forwarding MUX B', rt, 'האופרנד השני המקורי מגיע מהאוגר rt; ב־sw הוא גם נתון האחסון.'],
    [
      'Forwarding MUX A → ALU',
      fa,
      '00 בוחר מקור רגיל מ־ID/EX; 10 בוחר תוצאה מ־EX/MEM; 01 בוחר נתון מ־MEM/WB.',
    ],
    ['Forwarding MUX B → ALU', fb, 'הבורר מזין את האופרנד השני, או את הנתון שמשמש את sw.'],
    ['ALU → EX/MEM', 'ALUResult=' + alu, 'תוצאת ה־ALU עוברת ל־EX/MEM. ב־lw/sw זו כתובת, ובחשבון זו תוצאה.'],
    ['EX/MEM → Data Memory · Address', 'Address=' + alu, 'ב־lw וב־sw ה־ALU חישב כתובת בסיס ועוד offset.'],
    [
      'EX/MEM → Data Memory · Write Data',
      n === 'sw' ? 'WriteData=42' : `ReadData2=${rt} · MemWrite=${c.MemWrite}`,
      'החוט נושא את Read Data 2. הזיכרון משתמש בערך רק כאשר MemWrite=1.',
    ],
    ['Data Memory → MEM/WB', mem, 'רק lw מפעילה MemRead ומקבלת נתון מזיכרון הנתונים.'],
    ['MEM/WB → MemtoReg MUX', wb, 'הבורר מקבל ALUResult וגם ReadData; MemtoReg בוחר את הערך שיוחזר.'],
    [
      'MemtoReg MUX → Register File',
      wb + ' · RegWrite=' + c.RegWrite,
      'הערך הנבחר חוזר לקובץ האוגרים. כתיבה מתבצעת רק אם RegWrite=1.',
    ],
    [
      'EX/MEM → Forwarding Unit',
      'EX/MEM.Rd · RegWrite=' + c.RegWrite,
      'יחידת Forwarding בודקת אם היעד שנכתב בפקודה קודמת תואם ל־rs או ל־rt של הפקודה הנוכחית.',
    ],
    [
      'MEM/WB → Forwarding Unit',
      'MEM/WB.Rd · RegWrite=' + c.RegWrite,
      'היחידה בודקת גם תוצאה שנמצאת בשלב WB, כדי לבחור אם לעקוף את קובץ האוגרים.',
    ],
    ['Forwarding Unit → MUX A', fa, 'ForwardA=00: מקור ID/EX; 10: מקור EX/MEM; 01: מקור MEM/WB.'],
    ['Forwarding Unit → MUX B', fb, 'ForwardB משתמש באותם קודים כדי לבחור את הנתון העדכני לקלט B.'],
    [
      'Control Unit → ID/EX · אותות EX',
      `RegDst=${c.RegDst ?? 'X'} · ALUSrc=${c.ALUSrc ?? 'X'} · ALUOp=${c.ALUOp1 ?? 'X'}${c.ALUOp0 ?? 'X'}`,
      'הבקרה של EX נשמרת בתוך ID/EX ומגיעה עם הפקודה המתאימה.',
    ],
    [
      'ID/EX → ALU Control',
      'ALUOp=' + `${c.ALUOp1 ?? 'X'}${c.ALUOp0 ?? 'X'}` + ' · funct של הפקודה',
      'ALU Control מתרגם את ALUOp ואת funct לפעולה כמו חיבור או חיסור.',
    ],
    [
      'EX/MEM → Data Memory · אותות MEM',
      `MemRead=${c.MemRead ?? 'X'} · MemWrite=${c.MemWrite ?? 'X'} · Branch=${c.Branch ?? 'X'}`,
      'הבקרה עוברת דרך EX/MEM ומחליטה אם לקרוא או לכתוב בזיכרון.',
    ],
    [
      'MEM/WB → MUX / Register File · אותות WB',
      `RegWrite=${c.RegWrite ?? 'X'} · MemtoReg=${c.MemtoReg ?? 'X'}`,
      'אותות WB נשמרים עד מחזור הכתיבה. X מציין שהערך לא משפיע כי הפקודה לא משתמשת בנתיב.',
    ],
    [
      'Hazard Unit → PC · PCWrite',
      state.hazardDemo === 'load' ? 'PCWrite=0 · עצירה למחזור אחד' : 'PCWrite=1 · ה־PC מתקדם',
      'בתלות lw-use ה־PC קפוא כדי שלא נביא הוראה חדשה במקום ההוראה שממתינה.',
    ],
    [
      'Hazard Unit → IF/ID · IF/IDWrite',
      state.hazardDemo === 'load' ? 'IF/IDWrite=0 · הפקודה נשארת' : 'IF/IDWrite=1 · אפשר לעדכן',
      'בזמן stall, הפקודה ב־IF/ID נשמרת. במקביל ID/EX.Flush=1 מכניס בועה ל־EX.',
    ],
  ];
  return a[Math.min(index, a.length - 1)];
}
export function bindPipelineInspector() {
  const panel = document.getElementById('pipe-inspector');
  document.getElementById('pipe-inspector-close').onclick = () => panel.classList.remove('open', 'pinned');
  panel.onmouseenter = () => {
    if (timers.hoverHideTimer) {
      clearTimeout(timers.hoverHideTimer);
      timers.hoverHideTimer = null;
    }
  };
  panel.onmouseleave = () => {
    if (!panel.classList.contains('pinned')) panel.classList.remove('open');
  };
  document.querySelectorAll('#pipeline-svg .pipe-wire').forEach((p, i) => {
    p.setAttribute('tabindex', '0');
    p.setAttribute('role', 'button');
    const show = (pin) => {
      const x = pipeWireDetail(i, p.dataset.controlLine);
      document.getElementById('pipe-inspector-title').textContent = x[0];
      document.getElementById('pipe-inspector-value').textContent = 'הערך על הקו: ' + x[1];
      document.getElementById('pipe-inspector-why').textContent = x[2];
      panel.classList.add('open');
      panel.classList.toggle('pinned', pin);
    };
    p.onmouseenter = () => {
      if (timers.hoverHideTimer) {
        clearTimeout(timers.hoverHideTimer);
        timers.hoverHideTimer = null;
      }
      if (!panel.classList.contains('pinned')) show(false);
    };
    p.onmouseleave = () => {
      if (!panel.classList.contains('pinned'))
        timers.hoverHideTimer = setTimeout(() => {
          if (!panel.matches(':hover')) panel.classList.remove('open');
        }, 320);
    };
    p.onclick = (e) => {
      e.stopPropagation();
      show(true);
    };
    p.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        show(true);
      }
    };
  });
}
export function renderPipeWireTags() {
  const d = instructions[state.pipeInst],
    n = d.name,
    c = d.controls;
  const v = {
    add: [
      'PC=0x00400000',
      'Instr=0x012A4020',
      'rs=9→R9=7',
      'ReadData1=7',
      'imm=—',
      'R9=7',
      'R10=5',
      'ALU A=7',
      'ALU B=5',
      'ALUResult=12',
      'Address=12',
      'WriteData=5',
      'ReadData=—',
      'MemtoReg=0 · 12',
      'WB=12→R8',
    ],
    addi: [
      'PC=0x00400000',
      'Instr=0x21280008',
      'rs=9→R9=7',
      'ReadData1=7',
      'imm=8',
      'R9=7',
      'imm=8',
      'ALU A=7',
      'ALU B=8',
      'ALUResult=15',
      'Address=15',
      'WriteData=—',
      'ReadData=—',
      'MemtoReg=0 · 15',
      'WB=15→R8',
    ],
    lw: [
      'PC=0x00400000',
      'Instr=0x8D280004',
      'rs=9→R9=100',
      'ReadData1=100',
      'imm=4',
      'R9=100',
      'imm=4',
      'ALU A=100',
      'ALU B=4',
      'Address=104',
      'Address=104',
      'WriteData=—',
      'ReadData=42',
      'MemtoReg=1 · 42',
      'WB=42→R8',
    ],
    sw: [
      'PC=0x00400000',
      'Instr=0xAD280004',
      'rs=9→R9=100',
      'ReadData1=100',
      'imm=4',
      'R9=100',
      'imm=4',
      'ALU A=100',
      'ALU B=4',
      'Address=104',
      'Address=104',
      'WriteData=42',
      'ReadData=—',
      'לא כותבים לאוגר',
      'WB=—',
    ],
    beq: [
      'PC=0x00400000',
      'Instr=0x11090003',
      'rs=8→R8=7',
      'ReadData1=7',
      'offset=3',
      'R8=7',
      'R9=7',
      'ALU A=7',
      'ALU B=7',
      '7−7=0 · Zero=1',
      'Branch test',
      'WriteData=—',
      'ReadData=—',
      'לא כותבים לאוגר',
      'WB=—',
    ],
    j: [
      'PC=0x00400000',
      'Instr=0x08000100',
      'rs=—',
      'ReadData1=—',
      'target=0x100',
      '—',
      '—',
      'A=—',
      'B=—',
      '—',
      '—',
      '—',
      '—',
      'לא כותבים לאוגר',
      'WB=—',
    ],
  }[n];
  // The ALUSrc and RegDst boxes show what this instruction actually selects.
  const destination = d.syntax.split(/[\s,]+/)[1] || '—',
    aluB = v[8].replace(/^ALU\s*/, '');
  setText('pipe-alusrc-value', `${c.ALUSrc ?? 'X'} · ${c.ALUSrc === undefined || c.ALUSrc === null ? '—' : aluB}`);
  setText(
    'pipe-regdst-value',
    `${c.RegDst ?? 'X'} · ${c.RegDst === 1 ? 'rd' : c.RegDst === 0 ? 'rt' : '—'}${c.RegDst === 0 || c.RegDst === 1 ? '=' + destination : ''}`,
  );
  const p = pipelineRoutePositions,
    stageFor = pipelineRouteStages,
    g = document.getElementById('pipe-wire-labels'),
    hz =
      state.hazardDemo === 'load'
        ? { pc: 0, ifid: 0, iflush: 0, idflush: 0, exflush: 1, stall: 1 }
        : {
            pc: 1,
            ifid: 1,
            iflush: n === 'beq' || n === 'j' ? 1 : 0,
            idflush: 0,
            exflush: n === 'beq' || n === 'j' ? 1 : 0,
            stall: 0,
          },
    pcsrc = n === 'beq' ? 'Branch∧Zero=1' : n === 'j' ? 'Jump=1' : '0 · PC+4';
  let html = p
    .map((q, i) => {
      const t = v[i],
        w = Math.min(154, Math.max(58, t.length * 5.5 + 14));
      return `<g class="pipe-route-tag ${stageFor[i] === state.pipeStep ? 'active' : ''}" data-pipe-step="${stageFor[i]}" transform="translate(${q.x - w / 2},${q.y - 10})"><rect width="${w}" height="20"/><text x="${w / 2}" y="13">${t}</text></g>`;
    })
    .join('');
  const tags = [
    {
      x: 445,
      y: 478,
      w: 188,
      step: 2,
      key: 'EX/Control',
      text: `EX: RegDst=${c.RegDst ?? 'X'} · ALUSrc=${c.ALUSrc ?? 'X'} · ALUOp=${c.ALUOp1 ?? 'X'}${c.ALUOp0 ?? 'X'}`,
    },
    {
      x: 645,
      y: 478,
      w: 190,
      step: 3,
      key: 'MEM/Control',
      text: `MEM: Branch=${c.Branch ?? 'X'} · MemRead=${c.MemRead ?? 'X'} · MemWrite=${c.MemWrite ?? 'X'}`,
    },
    {
      x: 850,
      y: 478,
      w: 188,
      step: 4,
      key: 'WB/Control',
      text: `WB: RegWrite=${c.RegWrite ?? 'X'} · MemtoReg=${c.MemtoReg ?? 'X'}`,
    },
    {
      x: 1045,
      y: 478,
      w: 190,
      step: 2,
      key: 'Forwarding',
      text: `ForwardA=${state.hazardDemo === 'alu' ? '10' : state.hazardDemo === 'load' ? '01' : '00'} · ForwardB=00`,
    },
    { x: 20, y: 520, w: 155, step: 0, key: 'PCWrite', text: `PCWrite=${hz.pc}` },
    { x: 190, y: 165, w: 190, step: 0, key: 'IF/IDWrite', text: `IF/IDWrite=${hz.ifid}` },
    {
      x: 390,
      y: 520,
      w: 235,
      step: 1,
      key: 'Flush',
      text: `IF.Flush=${hz.iflush} · ID.Flush=${hz.idflush} · EX.Flush=${hz.exflush}`,
    },
    {
      x: 810,
      y: 520,
      w: 195,
      step: 3,
      key: 'MemAccess',
      text: `MemRead=${c.MemRead ?? 'X'} · MemWrite=${c.MemWrite ?? 'X'}`,
    },
    { x: 1040, y: 520, w: 180, step: 0, key: 'PCSrc', text: `PCSrc=${pcsrc}` },
  ];
  html += tags
    .map(
      (t) =>
        `<g class="pipe-route-tag control ${t.step === state.pipeStep ? 'active' : ''}" data-pipe-step="${t.step}" data-control-line="${t.key}" transform="translate(${t.x},${t.y})"><rect width="${t.w}" height="21"/><text x="${t.w / 2}" y="13.5">${t.text}</text></g>`,
    )
    .join('');
  g.innerHTML = html;
}
export function pipeSetInstruction(i) {
  state.pipeInst = (i + instructions.length) % instructions.length;
  state.pipeStep = 0;
  renderPipeline();
}
export function renderPipeline() {
  const d = instructions[state.pipeInst],
    c = d.controls,
    trace = pipeTrace[d.name],
    hex = (routeInfo[d.name][1].match(/0x[\da-f]+/i) || [])[0] || 'X';
  document.getElementById('pipeline-instruction-picker').innerHTML = instructions
    .map(
      (x, i) =>
        `<button class="instruction-choice ${i === state.pipeInst ? 'active' : ''}" data-pipe-instruction="${i}">${x.name}</button>`,
    )
    .join('');
  document
    .querySelectorAll('[data-pipe-instruction]')
    .forEach((b) => (b.onclick = () => pipeSetInstruction(+b.dataset.pipeInstruction)));
  document.getElementById('pipeline-stage-buttons').innerHTML = pipeStageNames
    .map(
      (name, i) =>
        `<button class="pipe-stage-btn ${i === state.pipeStep ? 'active' : ''}" data-pipe-stage="${i}">${name}</button>`,
    )
    .join('');
  document.querySelectorAll('[data-pipe-stage]').forEach(
    (b) =>
      (b.onclick = () => {
        state.pipeStep = +b.dataset.pipeStage;
        renderPipeline();
      }),
  );
  document.getElementById('pipeline-stage-track').innerHTML = pipeStageNames
    .map(
      (name, i) =>
        `<b class="${i === state.pipeStep ? 'active' : ''}">${name.split(' · ')[0]}</b>${i < 4 ? '<span>→</span>' : ''}`,
    )
    .join('');
  document.getElementById('pipe-stage-kicker').textContent = `שלב ${state.pipeStep + 1} מתוך 5 · ${d.name}`;
  document.getElementById('pipe-stage-title').textContent = pipeStageNames[state.pipeStep];
  document.getElementById('pipe-stage-explanation').textContent =
    trace[state.pipeStep][0] + ' ' + trace[state.pipeStep][1];
  document.getElementById('pipe-value-list').innerHTML = trace
    .map(
      (row, i) =>
        `<div class="pipe-value ${i === state.pipeStep ? 'active' : ''}"><b>${pipeStageNames[i]}</b><span>${row[2]}</span><span>${row[3]}</span></div>`,
    )
    .join('');
  document.getElementById('pipe-status').textContent = `${d.syntax} · ${hex}`;
  document.getElementById('pipe-prev').disabled = state.pipeStep === 0;
  document.getElementById('pipe-next').textContent = state.pipeStep === 4 ? 'סיום הפקודה' : 'השלב הבא ←';
  const stageXs = pipelineStageXs;
  document.getElementById('pipe-token').setAttribute('cx', stageXs[state.pipeStep]);
  document.getElementById('pipe-token').setAttribute('cy', 105);
  document.getElementById('pipe-token-label').setAttribute('x', stageXs[state.pipeStep]);
  document.getElementById('pipe-token-label').textContent = d.name;
  document
    .querySelectorAll('[data-pipe-step]')
    .forEach((w) =>
      w.classList.toggle('active', w.getAttribute('data-pipe-step') === String(state.pipeStep)),
    );
  document
    .querySelectorAll('[data-latch]')
    .forEach((x) =>
      x.classList.toggle(
        'active',
        +x.dataset.latch === state.pipeStep || +x.dataset.latch === state.pipeStep - 1,
      ),
    );
  document
    .querySelectorAll('[data-pipe-unit]')
    .forEach((x) =>
      x
        .querySelector('.pipe-unit')
        ?.classList.toggle(
          'active',
          ((x.dataset.pipeUnit === 'PC' || x.dataset.pipeUnit === 'Instruction Memory') &&
            state.pipeStep === 0) ||
            (x.dataset.pipeUnit === 'Register File' && (state.pipeStep === 1 || state.pipeStep === 4)) ||
            (x.dataset.pipeUnit === 'MUX A' && state.pipeStep === 2) ||
            (x.dataset.pipeUnit === 'MUX B' && state.pipeStep === 2) ||
            (x.dataset.pipeUnit === 'ALU' && state.pipeStep === 2) ||
            (x.dataset.pipeUnit === 'Data Memory' && state.pipeStep === 3),
        ),
    );
  const r = liveValues[d.name],
    control = [
      `RegWrite=${d.controls.RegWrite ?? 'X'}`,
      `MemRead=${d.controls.MemRead ?? 'X'}`,
      `MemWrite=${d.controls.MemWrite ?? 'X'}`,
    ].join(' · ');
  document.getElementById('pipe-pc-value').textContent = 'PC=0x00400000';
  document.getElementById('pipe-instr-value').textContent = 'Instr=' + hex;
  document.getElementById('pipe-id-value').textContent =
    `rs=${d.name === 'beq' ? 8 : d.name === 'j' ? 'X' : 9} · rt=${d.name === 'add' ? 10 : d.name === 'beq' ? 9 : d.name === 'j' ? 'X' : 8}`;
  document.getElementById('pipe-reg-data').textContent = {
    add: 'R9=7 · R10=5',
    addi: 'R9=7 · R8=0',
    lw: 'R9=100 · R8=X',
    sw: 'R9=100 · R8=42',
    beq: 'R8=7 · R9=7',
    j: 'לא קוראים אוגרים',
  }[d.name];
  document.getElementById('pipe-imm').textContent = r.imm;
  document.getElementById('pipe-control').textContent =
    `RegWrite=${d.controls.RegWrite ?? 'X'} · Branch=${d.controls.Branch ?? 'X'}`;
  document.getElementById('pipe-alu').textContent = r.alu;
  document.getElementById('pipe-zero').textContent = 'Zero=' + (/Zero=(\d)/.exec(r.alu)?.[1] || '0');
  document.getElementById('pipe-alu-control').textContent =
    d.name === 'beq' ? '0110 · SUB' : d.name === 'j' ? 'לא בשימוש' : '0010 · ADD';
  document.getElementById('pipe-mem').textContent =
    `MemRead=${d.controls.MemRead ?? 'X'} · MemWrite=${d.controls.MemWrite ?? 'X'}`;
  document.getElementById('pipe-mem-value').textContent =
    d.name === 'lw'
      ? 'Address=104 · ReadData=42'
      : d.name === 'sw'
        ? 'Address=104 · WriteData=42'
        : d.name === 'j'
          ? 'לא בשימוש'
          : 'Memory לא פעיל';
  document.getElementById('pipe-wb').textContent =
    d.name === 'lw' ? '42 → R8' : d.name === 'add' ? '12 → R8' : d.name === 'addi' ? '15 → R8' : 'ללא כתיבה';
  document.getElementById('pipe-wb-value').textContent = trace[4][2];
  document.getElementById('pipe-ex-value').textContent = trace[2][2];
  document.getElementById('pipe-fwd-a').textContent =
    state.hazardDemo === 'alu' ? 'FwdA=10' : state.hazardDemo === 'load' ? 'FwdA=01' : 'FwdA=00';
  document.getElementById('pipe-fwd-b').textContent = 'FwdB=00';
  document.getElementById('pipe-forwarding').textContent =
    state.hazardDemo === 'none'
      ? 'ForwardA=00 · B=00'
      : state.hazardDemo === 'alu'
        ? 'ForwardA=10 · B=00'
        : 'ForwardA=01 · B=00';
  const hz =
    state.hazardDemo === 'load'
      ? { stall: 1, pc: 0, ifid: 0, flush: 1 }
      : state.hazardDemo === 'control'
        ? { stall: 0, pc: 1, ifid: 1, flush: 0 }
        : { stall: 0, pc: 1, ifid: 1, flush: 0 };
  document.getElementById('pipe-hazard-bits').textContent = `Stall=${hz.stall} · PCWrite=${hz.pc}`;
  document.getElementById('pipe-hazard-wire').textContent = `PCWrite=${hz.pc} · IF/IDWrite=${hz.ifid}`;
  const lesson = {
    none: {
      html: '<b>אין סיכון:</b> הפקודה מקבלת את הערכים שלה בזמן. PCWrite=1 ו־IF/IDWrite=1, לכן הצינור מתקדם כרגיל.',
      fa: '00',
      fb: '00',
      stall: '0',
      pc: '1',
      ifid: '1',
      iflush: '0',
      idflush: '0',
      exflush: '0',
      rows: [
        ['סיבה', 'אין תלות בין הפקודות'],
        ['תגובה', 'ממשיכים בלי עצירה'],
        ['בועה', 'לא נוצרת'],
      ],
    },
    alu: {
      html: '<b>סיכון נתונים RAW · התוצאה כבר מוכנה:</b> פקודה קודמת כתבה ל־R16, והפקודה הבאה קוראת אותו לפני שהערך הגיע לקובץ האוגרים. Forwarding מעתיק את התוצאה ישירות מ־EX/MEM אל קלט ה־ALU. כך אין צורך לחכות לכתיבה לקובץ האוגרים.',
      fa: '10',
      fb: '00',
      stall: '0',
      pc: '1',
      ifid: '1',
      iflush: '0',
      idflush: '0',
      exflush: '0',
      rows: [
        ['סוג', 'RAW · קריאה אחרי כתיבה'],
        ['ForwardA', '10 · EX/MEM → ALU A'],
        ['ForwardB', '00 · הערך הרגיל מ־ID/EX'],
        ['Stall / בועה', '0 · אין צורך לעצור'],
      ],
    },
    load: {
      html: '<b>סיכון נתונים RAW · lw-use:</b> lw מביאה את הערך מהזיכרון רק בסוף שלב MEM. הפקודה שאחריה צריכה אותו כבר ב־EX, מחזור מוקדם מדי. לכן Hazard Detection מקפיאה את ה־PC ואת IF/ID למחזור אחד, ומכניסה NOP ל־ID/EX (ID/EX.Flush=1). זו הבועה. אחר כך הנתון מועבר קדימה מ־MEM/WB.',
      fa: '01',
      fb: '00',
      stall: '1',
      pc: '0',
      ifid: '0',
      iflush: '0',
      idflush: '0',
      exflush: '1',
      rows: [
        ['סוג', 'RAW · נתון lw עוד לא מוכן'],
        ['PCWrite', '0 · כתובת הפקודה נשארת'],
        ['IF/IDWrite', '0 · הפקודה ממתינה'],
        ['ID/EX.Flush', '1 · מכניסים NOP/בועה'],
        ['אחרי ההמתנה', 'ForwardA=01 · MEM/WB → ALU'],
      ],
    },
    structural: {
      html: '<b>סיכון מבני · שניים רוצים אותו משאב:</b> למשל, אם הוראה ו־lw היו ניגשות באותו מחזור לאותו זיכרון יחיד, הייתה התנגשות. בתרשים הזה יש Instruction Memory ו־Data Memory נפרדים, לכן המשאבים שונים: אין התנגשות, אין סיכון מבני ואין בועה. בזיכרון אחוד מקובל להקפיא PC ו־IF/ID ולהכניס בועה.',
      fa: '00',
      fb: '00',
      stall: '0 כאן',
      pc: '1 כאן',
      ifid: '1 כאן',
      iflush: '0',
      idflush: '0',
      exflush: '0',
      rows: [
        ['המשאב', 'זיכרון פקודות נפרד מזיכרון נתונים'],
        ['בתרשים הזה', 'אין התנגשות · אין בועה'],
        ['בזיכרון אחוד', 'PCWrite=0 · IF/IDWrite=0'],
        ['פתרון נפוץ', 'המתנה של מחזור או זיכרונות נפרדים'],
      ],
    },
    control: {
      html: '<b>סיכון בקרה · branch או jump:</b> המעבד לא יודע מיד אם להמשיך ישר או לפנות. אם branch נלקחת, פקודות צעירות שכבר נכנסו למסלול השגוי מבוטלות וה־PC מקבל את כתובת היעד. באתר הזה branch מוכרעת ב־ID, ולכן IF.Flush=1 מבטל פקודה אחת בלבד: זו שנשלפה ב־IF באותו מחזור.',
      fa: '00',
      fb: '00',
      stall: '0',
      pc: '1',
      ifid: '1',
      iflush: '1',
      idflush: 'לפי המימוש',
      exflush: 'לפי המימוש',
      rows: [
        ['גורם', 'Branch/Jump משנה את ה־PC'],
        ['Branch ∧ Zero', '1 · בוחרים כתובת יעד'],
        ['IF.Flush', '1 · מבטלים הוראה צעירה במסלול הישן'],
        ['בועה', 'הפקודה שבוטלה לא משנה אוגר או זיכרון'],
        ['הערה', 'עומק הניקוי תלוי בשלב הכרעת branch'],
      ],
    },
    war: {
      html: '<b>WAR · כתיבה לפני קריאה:</b> פקודה צעירה כותבת לאוגר לפני שפקודה ותיקה הספיקה לקרוא אותו. בצינור MIPS הקלאסי, הקריאה היא מוקדם (ID) והכתיבה מאוחר (WB), והפקודות מסתיימות לפי הסדר; לכן WAR לא נוצר. הוא עלול להופיע במעבד שמריץ פקודות מחוץ לסדר.',
      fa: '00',
      fb: '00',
      stall: '0',
      pc: '1',
      ifid: '1',
      iflush: '0',
      idflush: '0',
      exflush: '0',
      rows: [
        ['האם קורה כאן?', 'לא · צינור in-order קלאסי'],
        ['למה?', 'קריאה ב־ID לפני כתיבה ב־WB'],
        ['במעבד out-of-order', 'נדרשת renaming/בקרה מתאימה'],
      ],
    },
    waw: {
      html: '<b>WAW · כתיבה אחרי כתיבה:</b> שתי פקודות כותבות לאותו אוגר, אבל כתיבה מאוחרת יותר מגיעה קודם וכותבת ראשונה. בצינור MIPS הקלאסי כל פקודה כותבת ב־WB לפי הסדר, ולכן הסדר נשמר ו־WAW לא נוצר. במעבד out-of-order משתמשים למשל בשמות אוגרים פיזיים.',
      fa: '00',
      fb: '00',
      stall: '0',
      pc: '1',
      ifid: '1',
      iflush: '0',
      idflush: '0',
      exflush: '0',
      rows: [
        ['האם קורה כאן?', 'לא · כתיבה ל־WB לפי הסדר'],
        ['למה?', 'פקודה צעירה לא עוקפת ותיקה'],
        ['במעבד out-of-order', 'renaming מונע התנגשות שמות'],
      ],
    },
  }[state.hazardDemo];
  document.getElementById('pipe-fwd-a').textContent = `FwdA=${lesson.fa}`;
  document.getElementById('pipe-fwd-b').textContent = `FwdB=${lesson.fb}`;
  document.getElementById('pipe-forwarding').textContent = `ForwardA=${lesson.fa} · B=${lesson.fb}`;
  document.getElementById('hazard-readout').innerHTML = lesson.html;
  document.getElementById('pipe-control-values').innerHTML = [
    ['ForwardA', lesson.fa, '00=ID/EX · 10=EX/MEM · 01=MEM/WB'],
    ['ForwardB', lesson.fb, '00=ID/EX · 10=EX/MEM · 01=MEM/WB'],
    ['Stall', lesson.stall, '1=עוצרים מחזור'],
    ['PCWrite', lesson.pc, '0=מקפיאים את ה־PC'],
    ['IF/IDWrite', lesson.ifid, '0=משאירים את הפקודה ב־IF/ID'],
    ['IF.Flush', lesson.iflush, '1=מנקים הוראה צעירה'],
    ['ID.Flush', lesson.idflush, 'ניקוי לפי נקודת ההכרעה'],
    ['EX.Flush', lesson.exflush, '1=מכניסים NOP לשלב EX'],
    ...lesson.rows,
  ]
    .map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2] ?? ''}</td></tr>`)
    .join('');
  document.getElementById('pipe-control-ex').textContent =
    `RegDst=${c.RegDst ?? 'X'} · ALUSrc=${c.ALUSrc ?? 'X'} · ALUOp=${c.ALUOp1 ?? 'X'}${c.ALUOp0 ?? 'X'}`;
  document.getElementById('pipe-control-fwd').textContent =
    `FwdA=${lesson.fa} · FwdB=${lesson.fb} · ALUControl=${d.name === 'beq' ? '0110' : '0010'}`;
  document.getElementById('pipe-control-mem').textContent =
    `Branch=${c.Branch ?? 'X'} · PCSrc=${d.name === 'beq' ? '1' : '0'}`;
  document.getElementById('pipe-control-mem2').textContent =
    `Jump=${c.Jump ?? 'X'} · MemRead=${c.MemRead ?? 'X'} · MemWrite=${c.MemWrite ?? 'X'}`;
  document.getElementById('pipe-control-wb').textContent =
    `RegWrite=${c.RegWrite ?? 'X'} · MemtoReg=${c.MemtoReg ?? 'X'}`;
  document.getElementById('pipe-control-hazard').textContent =
    `PCWrite=${lesson.pc} · IF/IDWrite=${lesson.ifid}`;
  document.getElementById('pipe-control-flush').textContent =
    `IF.Flush=${lesson.iflush} · ID.Flush=${lesson.idflush} · EX.Flush=${lesson.exflush}`;
  document.getElementById('pipe-control-exception').textContent = 'Cause=— · EPC=— · Exception=0';
  document.querySelectorAll('[data-hazard]').forEach((b) => {
    b.classList.toggle('active', b.dataset.hazard === state.hazardDemo);
    b.onclick = () => {
      state.hazardDemo = b.dataset.hazard;
      renderPipeline();
    };
  });
  document.getElementById('pipe-next').onclick = () => {
    if (state.pipeStep < 4) {
      state.pipeStep++;
      renderPipeline();
    } else pipeSetInstruction(state.pipeInst + 1);
  };
  document.getElementById('pipe-prev').onclick = () => {
    state.pipeStep = Math.max(0, state.pipeStep - 1);
    renderPipeline();
  };
  renderSequence();
  renderPipeWireTags();
  bindPipelineInspector();
  document.getElementById('pipe-play').onclick = () => {
    if (timers.pipeTimer) {
      clearInterval(timers.pipeTimer);
      timers.pipeTimer = null;
      document.getElementById('pipe-play').textContent = '▶ הנפשה';
    } else {
      document.getElementById('pipe-play').textContent = '⏸ עצירה';
      timers.pipeTimer = setInterval(() => {
        if (state.cpuArchitecture !== 'pipeline') {
          clearInterval(timers.pipeTimer);
          timers.pipeTimer = null;
          return;
        }
        if (state.pipeStep < 4) {
          state.pipeStep++;
          renderPipeline();
        } else pipeSetInstruction(state.pipeInst + 1);
      }, 1800);
    }
  };
}
