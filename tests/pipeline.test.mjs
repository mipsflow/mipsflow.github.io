import test from 'node:test';
import assert from 'node:assert/strict';
import { schedulePipeline } from '../src/simulator/pipeline/timing.js';
import { parseImmediate, fitsSigned16 } from '../src/simulator/encoding/immediate.js';

// Minimal instruction records, in the shape the code tracer passes to schedulePipeline.
const ins = (op, reads, wr = null, extra = {}) => ({ q: { op, reads, wr }, ...extra });
const flushed = (op, reads, wr = null) => ({ q: { op, reads, wr }, flush: true });

/** Which instruction sits in each stage at the end of a given cycle. */
function snapshot(result, cycle, names) {
  const view = {};
  result.rows.forEach((row, i) => {
    const cell = row.cells[cycle];
    if (cell === 'IF' || cell === 'IF (קפוא)') view.IF = names[i];
    if (cell === 'ID' || cell === 'ID (המתנה)') view.ID = names[i];
    if (['EX', 'MEM', 'WB'].includes(cell)) view[cell] = names[i];
  });
  if (result.bubbles.some((b) => b.cycle === cycle)) view.EX = 'bubble';
  return view;
}

test('exam style: sub, lw, slt, sw – end of cycle 5 matches the exam diagram', () => {
  // sub $13,$3,$5 / lw $2,-0x400($13) / slt $4,$13,$2 / sw $4,4($13)
  const names = ['sub', 'lw', 'slt', 'sw'];
  const result = schedulePipeline([
    ins('sub', [3, 5], 13),
    ins('lw', [13], 2),
    ins('slt', [13, 2], 4),
    ins('sw', [13, 4]),
  ]);
  assert.deepEqual(snapshot(result, 5, names), { IF: 'sw', ID: 'slt', EX: 'bubble', MEM: 'lw', WB: 'sub' });
  assert.equal(result.rows[2].stallCycles, 1);
  assert.equal(result.bubbles.length, 1);
});

test('forwarding distances 1, 2 and 3 never stall', () => {
  const result = schedulePipeline([
    ins('add', [9, 10], 8),
    ins('sub', [8, 9], 11),
    ins('or', [8, 10], 12),
    ins('and', [8, 9], 13),
  ]);
  assert.deepEqual(
    result.rows.map((r) => r.stallCycles),
    [0, 0, 0, 0],
  );
  assert.equal(result.bubbles.length, 0);
});

test('a load followed two instructions later by its consumer does not stall', () => {
  const result = schedulePipeline([ins('lw', [16], 8), ins('add', [11, 11], 11), ins('sub', [8, 9], 10)]);
  assert.equal(result.rows[2].stallCycles, 0);
});

test('branch in ID: load two instructions before beq needs exactly one bubble', () => {
  const result = schedulePipeline([ins('lw', [16], 8), ins('add', [11, 11], 11), ins('beq', [8, 0])]);
  assert.equal(result.rows[2].stallCycles, 1);
});

test('writes to $zero never create a dependency', () => {
  const result = schedulePipeline([ins('add', [9, 10], 0), ins('add', [0, 0], 11)]);
  assert.equal(result.rows[1].stallCycles, 0);
});

test('a taken branch flushes only the wrong-path fetch and the target runs next', () => {
  const result = schedulePipeline([ins('beq', [0, 0]), flushed('addi', [0], 10), ins('or', [8, 8], 12)]);
  const flushRow = result.rows[1];
  assert.deepEqual(Object.values(flushRow.cells), ['Flush']);
  assert.equal(result.rows[2].cycles.IF, result.rows[0].cycles.ID + 1);
});

test('immediates: decimal and hexadecimal, with a sign', () => {
  assert.equal(parseImmediate('8'), 8);
  assert.equal(parseImmediate('-128'), -128);
  assert.equal(parseImmediate('0x400'), 1024);
  assert.equal(parseImmediate('-0x400'), -1024);
  assert.equal(parseImmediate('0XFF'), 255);
  assert.ok(Number.isNaN(parseImmediate('abc')));
  assert.ok(Number.isNaN(parseImmediate('')));
  assert.equal(fitsSigned16(-32768), true);
  assert.equal(fitsSigned16(32768), false);
});
