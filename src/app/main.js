// Application entry point: connects the views and starts the page.
import { instructions } from '../domain/instructions.js';
import { routeInfo } from '../domain/singleCycle.js';
import { setMode } from './appControls.js';
import { state } from './context.js';
import { renderPipeline } from './pipelineView.js';
import { runSelfTests } from './selfTest.js';
import { bindDiagramExplanations, render, setInst } from './singleCycleView.js';

document.getElementById('open-selftest').onclick = () =>
  document.getElementById('selftest-dialog').showModal();
document.getElementById('run-selftest').onclick = runSelfTests;
document.getElementById('dict-instructions').innerHTML = instructions
  .map(
    (d, i) =>
      `<button class="vocab" data-instruction="${i}"><b>${d.name}</b><small>${d.syntax}</small></button>`,
  )
  .join('');
document.querySelectorAll('[data-instruction]').forEach(
  (b) =>
    (b.onclick = () => {
      setInst(+b.dataset.instruction);
      setMode('manual');
    }),
);
bindDiagramExplanations();
render();

window.routeInfo = routeInfo;
window.renderPipeline = renderPipeline;

document.addEventListener('keydown', (event) => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.target.closest('textarea,input,select,[contenteditable="true"]')
  )
    return;
  const forward = event.key === 'ArrowLeft',
    back = event.key === 'ArrowRight';
  if (!forward && !back) return;
  const pipeline = state.cpuArchitecture === 'pipeline',
    id = pipeline ? (forward ? 'pipe-next' : 'pipe-prev') : forward ? 'next' : 'prev',
    button = document.getElementById(id);
  if (!button || button.disabled || !button.offsetParent) return;
  event.preventDefault();
  button.click();
});
for (const [id, title] of [
  ['next', 'אפשר גם עם החץ השמאלי במקלדת'],
  ['prev', 'אפשר גם עם החץ הימני במקלדת'],
  ['pipe-next', 'אפשר גם עם החץ השמאלי במקלדת'],
  ['pipe-prev', 'אפשר גם עם החץ הימני במקלדת'],
]) {
  const el = document.getElementById(id);
  if (el && !el.title) el.title = title;
}

// The code tracer extends window.renderPipeline, so it loads after the globals above exist.
await import('./codeTrace.js');
