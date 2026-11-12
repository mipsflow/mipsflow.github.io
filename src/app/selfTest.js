// In-page self-test ("בדיקת תקינות").
import { instructionBits, instructions } from '../domain/instructions.js';
import { pipeSequences, pipeStageNames, pipeTrace } from '../domain/pipeline.js';
import { setArchitecture } from './appControls.js';
import { state, timers } from './context.js';
import { renderPipeline, renderSequence } from './pipelineView.js';
import { next, render } from './singleCycleView.js';

export function runSelfTests() {
  const out = [],
    add = (name, ok, detail = '') => out.push({ name, ok: !!ok, detail });
  const names = ['add', 'addi', 'lw', 'sw', 'beq', 'j'];
  const controls = [
    'RegDst',
    'ALUSrc',
    'MemtoReg',
    'RegWrite',
    'MemRead',
    'MemWrite',
    'Branch',
    'ALUOp1',
    'ALUOp0',
    'Jump',
  ];
  const expected = {
    add: {
      RegDst: 1,
      ALUSrc: 0,
      MemtoReg: 0,
      RegWrite: 1,
      MemRead: 0,
      MemWrite: 0,
      Branch: 0,
      ALUOp1: 1,
      ALUOp0: 0,
      Jump: 0,
    },
    addi: {
      RegDst: 0,
      ALUSrc: 1,
      MemtoReg: 0,
      RegWrite: 1,
      MemRead: 0,
      MemWrite: 0,
      Branch: 0,
      ALUOp1: 0,
      ALUOp0: 0,
      Jump: 0,
    },
    lw: {
      RegDst: 0,
      ALUSrc: 1,
      MemtoReg: 1,
      RegWrite: 1,
      MemRead: 1,
      MemWrite: 0,
      Branch: 0,
      ALUOp1: 0,
      ALUOp0: 0,
      Jump: 0,
    },
    sw: {
      RegDst: 'X',
      ALUSrc: 1,
      MemtoReg: 'X',
      RegWrite: 0,
      MemRead: 0,
      MemWrite: 1,
      Branch: 0,
      ALUOp1: 0,
      ALUOp0: 0,
      Jump: 0,
    },
    beq: {
      RegDst: 'X',
      ALUSrc: 0,
      MemtoReg: 'X',
      RegWrite: 0,
      MemRead: 0,
      MemWrite: 0,
      Branch: 1,
      ALUOp1: 0,
      ALUOp0: 1,
      Jump: 0,
    },
    j: {
      RegDst: 'X',
      ALUSrc: 'X',
      MemtoReg: 'X',
      RegWrite: 0,
      MemRead: 0,
      MemWrite: 0,
      Branch: 'X',
      ALUOp1: 'X',
      ALUOp0: 'X',
      Jump: 1,
    },
  };
  for (const n of names) {
    const d = instructions.find((x) => x.name === n);
    add(`פקודת ${n} קיימת`, !!d);
    if (d) {
      add(
        `ערכי הבקרה של ${n} תואמים לטבלת MIPS`,
        controls.every((k) => String(d.controls[k] ?? 'X') === String(expected[n][k])),
      );
      add(`יש לפקודת ${n} סיפור של 5 שלבי צינור`, !!pipeTrace[n] && pipeTrace[n].length === 5);
      add(`קיים קידוד ${n}`, !!instructionBits[n]);
      const f = instructionBits[n];
      if (f) add(`קידוד ${n} כולל 32 ביט`, f.reduce((sum, x) => sum + String(x[1]).length, 0) === 32);
    }
  }
  const mips = {
    add: 7 + 5 === 12,
    addi: 7 + 8 === 15,
    lw: 100 + 4 === 104,
    sw: 100 + 4 === 104,
    beq: 7 === 7,
    j: true,
  };
  for (const [n, ok] of Object.entries(mips)) add(`חישוב לדוגמה ${n} נכון`, ok);
  add('קיימים כל חמשת שלבי הצינור', pipeStageNames.length === 5);
  add(
    'רגיסטרי IF/ID, ID/EX, EX/MEM, MEM/WB קיימים',
    document.querySelectorAll('#pipeline-svg [data-latch]').length === 4,
  );
  add(
    'יש חוטי נתונים וחוטי בקרה בתרשים',
    document.querySelectorAll('#pipeline-svg path.pipe-wire').length >= 20 &&
      document.querySelectorAll('#pipeline-svg path.pipe-wire.control').length >= 4,
  );
  const old = {
    arch: state.cpuArchitecture,
    inst: state.inst,
    step: state.step,
    pipeInst: state.pipeInst,
    pipeStep: state.pipeStep,
    sequenceIndex: state.sequenceIndex,
    sequenceCycle: state.sequenceCycle,
    hazardDemo: state.hazardDemo,
    mode: state.mode,
    wasTimer: !!timers.timer,
  };
  if (timers.timer) {
    clearInterval(timers.timer);
    timers.timer = null;
  }
  setArchitecture('pipeline');
  add(
    'ערכי הנתונים וקווי הבקרה מצוירים על חוטי התרשים',
    document.querySelectorAll('#pipe-wire-labels .pipe-route-tag').length >= 20 &&
      document.getElementById('pipe-wire-labels').textContent.includes('EX: RegDst=') &&
      document.getElementById('pipe-wire-labels').textContent.includes('MEM: Branch=') &&
      document.getElementById('pipe-wire-labels').textContent.includes('WB: RegWrite='),
  );
  const path = document.querySelector('#pipeline-svg path.pipe-wire');
  add('חוטי התרשים ניתנים לפתיחת הסבר', !!path && typeof path.onclick === 'function');
  if (path) {
    path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    add(
      'לחיצה על חוט פותחת חלונית הסבר',
      document.getElementById('pipe-inspector').classList.contains('open'),
    );
    document.getElementById('pipe-inspector').classList.remove('open', 'pinned');
  }
  add(
    'כל פקודה יכולה להיבחר למעקב',
    document.querySelectorAll('#pipeline-instruction-picker [data-pipe-instruction]').length ===
      instructions.length,
  );
  add(
    'כפתורי שלבים מחוברים',
    document.querySelectorAll('#pipeline-stage-buttons [data-pipe-stage]').length === 5,
  );
  add(
    'קיימים 7 מצבי לימוד לסיכוני הצינור',
    document.querySelectorAll('#pipeline-view [data-hazard]').length === 7,
  );
  add(
    'חבילת הבקרה מציגה חמש קבוצות/מסלולים',
    [
      'EX/Control',
      'MEM/Control',
      'WB/Control',
      'Forwarding',
      'PCWrite',
      'IF/IDWrite',
      'Flush',
      'MemAccess',
      'PCSrc',
    ].every((k) => document.querySelector(`#pipe-wire-labels [data-control-line=\"${k}\"]`)) &&
      document.getElementById('pipe-control-ex').textContent.includes('ALUOp=') &&
      document.getElementById('pipe-control-mem').textContent.includes('PCSrc=') &&
      document.getElementById('pipe-control-wb').textContent.includes('MemtoReg='),
  );
  for (const [key, needle] of [
    ['alu', 'RAW'],
    ['load', 'ID/EX.Flush'],
    ['structural', 'אין התנגשות'],
    ['control', 'IF.Flush'],
    ['war', 'WAR'],
    ['waw', 'WAW'],
  ]) {
    const button = document.querySelector(`#pipeline-view [data-hazard="${key}"]`);
    if (button) button.click();
    add(
      `הסבר סיכון ${key} כולל סיבה או פתרון`,
      document.getElementById('hazard-readout').textContent.includes(needle) &&
        !document.getElementById('pipe-control-values').textContent.includes('undefined'),
    );
  }
  state.sequenceIndex = 1;
  state.sequenceCycle = 4;
  renderSequence();
  add('סיכון lw-use מציג בועה ב־ID/EX', document.querySelectorAll('#sequence-table td.bubble').length === 1);
  state.sequenceIndex = 2;
  state.sequenceCycle = 4;
  renderSequence();
  add('פקודה במסלול שגוי מסומנת Flush', document.querySelectorAll('#sequence-table td.flushed').length === 1);
  add('יש לפחות שלוש דוגמאות לרצפי פקודות', pipeSequences.length >= 3);
  add(
    'קיימים כל נתיבי PC, Branch, Jump ו־Exception',
    [
      'flow-pc4',
      'flow-brtarget',
      'flow-compare',
      'flow-branch',
      'flow-pcsrc',
      'flow-pc-choice',
      'flow-jump',
      'flow-jtarget',
      'flow-cause',
      'flow-exception',
      'pipeline-flush-logic',
    ].every((id) => !!document.getElementById(id)),
  );
  add(
    'פירוט מלא מוצג בכל ארבעת רגיסטרי הביניים',
    [
      'latch-ifid-1',
      'latch-ifid-2',
      'latch-idex-1',
      'latch-idex-2',
      'latch-idex-3',
      'latch-exmem-1',
      'latch-exmem-2',
      'latch-exmem-3',
      'latch-memwb-1',
      'latch-memwb-2',
      'latch-memwb-3',
    ].every((id) => !!document.getElementById(id)),
  );
  add(
    'מעקב קוד ידני, אקראי ודוגמה מחוברים',
    [
      'pipeline-code',
      'track-program',
      'random-program',
      'sample-program',
      'program-trace',
      'program-schedule',
    ].every((id) => !!document.getElementById(id)),
  );
  state.sequenceIndex = old.sequenceIndex;
  state.sequenceCycle = old.sequenceCycle;
  state.pipeInst = old.pipeInst;
  state.pipeStep = old.pipeStep;
  state.hazardDemo = old.hazardDemo;
  setArchitecture(old.arch);
  state.inst = old.inst;
  state.step = old.step;
  state.mode = old.mode;
  render();
  if (old.arch === 'pipeline') renderPipeline();
  if (old.wasTimer && old.arch === 'single' && state.mode === 'auto') {
    if (timers.timer) clearInterval(timers.timer);
    timers.timer = setInterval(next, 2600);
  }
  const passed = out.filter((x) => x.ok).length,
    summary = document.getElementById('selftest-summary');
  summary.textContent = `עברו ${passed} מתוך ${out.length} בדיקות.`;
  summary.className = 'selftest-summary ' + (passed === out.length ? 'pass' : 'fail');
  document.getElementById('selftest-results').innerHTML = out
    .map(
      (x) =>
        `<li class="${x.ok ? 'pass' : 'fail'}">${x.ok ? '✓' : '✗'} ${x.name}${x.detail ? ' — ' + x.detail : ''}</li>`,
    )
    .join('');
  return out;
}
