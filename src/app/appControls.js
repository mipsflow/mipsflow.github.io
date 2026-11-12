// Processor and mode switching, buttons, control table, dictionary.
import { officialControlRows } from '../domain/controlTable.js';
import { instructions, vocab } from '../domain/instructions.js';
import { state, timers } from './context.js';
import { renderPipeline } from './pipelineView.js';
import { next, render, setInst } from './singleCycleView.js';

export function setArchitecture(type) {
  state.cpuArchitecture = type;
  document.querySelectorAll('[data-arch]').forEach((b) => {
    const active = b.dataset.arch === type;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  const pipeline = type === 'pipeline';
  document.getElementById('single-cycle-modes').classList.toggle('hidden', pipeline);
  document.getElementById('single-cycle-controls').classList.toggle('hidden', pipeline);
  document
    .getElementById('lesson')
    .classList.toggle('hidden', pipeline || state.mode === 'dict' || state.mode === 'srl');
  document.getElementById('dictionary').classList.toggle('hidden', pipeline || state.mode !== 'dict');
  document.getElementById('srl-page').classList.toggle('hidden', pipeline || state.mode !== 'srl');
  document.getElementById('pipeline-view').classList.toggle('hidden', !pipeline);
  if (timers.pipeTimer) {
    clearInterval(timers.pipeTimer);
    timers.pipeTimer = null;
    document.getElementById('pipe-play').textContent = '▶ הנפשה';
  }
  if (pipeline) renderPipeline();
  else if (state.mode === 'auto' && !timers.timer) timers.timer = setInterval(next, 2600);
}
document.querySelectorAll('[data-arch]').forEach((b) => (b.onclick = () => setArchitecture(b.dataset.arch)));
document.getElementById('pipeline-view').dataset.panel = 'diagram';
document.querySelectorAll('[data-pipe-panel]').forEach(
  (b) =>
    (b.onclick = () => {
      const view = document.getElementById('pipeline-view');
      view.dataset.panel = b.dataset.pipePanel;
      document.querySelectorAll('[data-pipe-panel]').forEach((x) => x.classList.toggle('active', x === b));
    }),
);
document
  .querySelectorAll('[data-arch]')
  .forEach((b) =>
    b.addEventListener('click', () =>
      document.body.classList.toggle('pipeline-mode', b.dataset.arch === 'pipeline'),
    ),
  );
export function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  if (state.cpuArchitecture === 'single') {
    document.getElementById('lesson').classList.toggle('hidden', m === 'dict' || m === 'srl');
    document.getElementById('dictionary').classList.toggle('hidden', m !== 'dict');
    document.getElementById('srl-page').classList.toggle('hidden', m !== 'srl');
  }
  if (timers.timer) {
    clearInterval(timers.timer);
    timers.timer = null;
  }
  if (m === 'auto' && state.cpuArchitecture === 'single') timers.timer = setInterval(next, 2600);
  const autoBtn = document.querySelector('.mode-btn[data-mode="auto"]');
  if (autoBtn) {
    autoBtn.textContent = m === 'auto' ? '⏸ עצירת הסרטון' : '▶ סרטון אוטומטי';
    autoBtn.setAttribute('aria-pressed', String(m === 'auto'));
  }
  render();
}
document
  .querySelectorAll('.mode-btn')
  .forEach(
    (b) =>
      (b.onclick = () =>
        setMode(b.dataset.mode === 'auto' && state.mode === 'auto' ? 'manual' : b.dataset.mode)),
  );
document.getElementById('route-toggle').onclick = () => {
  state.showAllRoutes = !state.showAllRoutes;
  const b = document.getElementById('route-toggle');
  b.textContent = state.showAllRoutes ? 'הצג רק את התחנה הנוכחית' : 'הצג את כל הפסים';
  b.setAttribute('aria-pressed', String(state.showAllRoutes));
  render();
};
document.getElementById('info-close').onclick = () => {
  state.infoPinned = false;
  document.getElementById('info-panel').classList.remove('open');
};
document.getElementById('next').onclick = next;
document.getElementById('prev').onclick = () => {
  if (state.step > 0) {
    state.step--;
    render();
  } else setInst(state.inst - 1);
};
document.getElementById('nextInst').onclick = () => setInst(state.inst + 1);
document.getElementById('restart').onclick = () => {
  setInst(0);
  setMode('manual');
};
document.querySelectorAll('[data-jump]').forEach((b) => (b.onclick = () => setMode(b.dataset.jump)));
document
  .querySelectorAll('[data-answer]')
  .forEach(
    (b) =>
      (b.onclick = () =>
        (document.getElementById('quiz-result').textContent =
          b.dataset.answer === 'right'
            ? 'נכון! 18 בהוראות ל־ALU Control אחת הופך ל־9. 🎉'
            : 'נסו שוב: הזזה ימינה אחת מחלקת ב־2.')),
  );
document.getElementById('vocab-grid').innerHTML = vocab
  .map((v, i) => `<button class="vocab" data-vocab="${i}"><b>${v[0]}</b><small>${v[1]}</small></button>`)
  .join('');
document.querySelectorAll('[data-vocab]').forEach(
  (b) =>
    (b.onclick = () => {
      let v = vocab[+b.dataset.vocab],
        box = document.getElementById('glossary-detail');
      box.innerHTML = `<b>${v[0]} · ${v[1]}</b><br>${v[2]}`;
      box.classList.add('open');
    }),
);

export function renderControlTable() {
  const headers = [
    'Instruction',
    'Opcode',
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
  const selected =
    instructions[state.inst].name === 'add'
      ? 'R-Type'
      : instructions[state.inst].name === 'j'
        ? 'J'
        : instructions[state.inst].name;
  const html =
    '<thead><tr>' +
    headers.map((h) => `<th>${h}</th>`).join('') +
    '</tr></thead><tbody>' +
    officialControlRows
      .map(
        (row) =>
          `<tr class="${row[0] === selected ? 'selected' : ''}" aria-current="${row[0] === selected ? 'true' : 'false'}">${row.map((v, i) => `<td>${i < 2 ? v : `<code>${v}</code>`}</td>`).join('')}</tr>`,
      )
      .join('') +
    '</tbody>';
  document.getElementById('control-table-top').innerHTML = html;
  document.getElementById('large-table').innerHTML = html;
}
renderControlTable();
// Keep the control table directly beneath the single-cycle datapath it describes.
export const datapathDiagram = document.querySelector('#lesson #stage');
export const singleCycleControls = document.getElementById('single-cycle-controls');
if (datapathDiagram && singleCycleControls) datapathDiagram.after(singleCycleControls);
