import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeInstruction, formatWord, signExtend16 } from '../src/simulator/encoding/mips.js';
import { detectLoadUseHazard, hazardControls } from '../src/simulator/pipeline/hazardDetection.js';
import { forwardingSelect } from '../src/simulator/pipeline/forwarding.js';
import { reducer, initialState, createStore } from '../src/state/store.js';
import { instructions } from '../src/domain/instructions.js';
import { controlKeys, officialControlRows } from '../src/domain/controlTable.js';
import { pipeStageNames, pipeSequences } from '../src/domain/pipeline.js';
import { routeInfo, routeLessons } from '../src/domain/singleCycle.js';
import { instructionComputed } from '../src/simulator/single-cycle/addressing.js';
import { schedulePipeline } from '../src/simulator/pipeline/timing.js';

test('all simulator data and diagram modules load as ES modules', () => {
  assert.equal(instructions.length, 6);
  assert.equal(controlKeys.length, 10);
  assert.equal(officialControlRows.length, 6);
  assert.equal(pipeStageNames.length, 5);
  assert.ok(pipeSequences.length > 0);
  assert.equal(routeLessons.length, routeInfo.add.length);
  assert.deepEqual(instructionComputed('add'), {
    word: 0x012a4020,
    imm: 0x4020,
    field: 0x012a4020,
    branchTarget: 0x00410084,
    jumpTarget: 0x04a90080,
  });
});

test('MIPS instruction encodings match the teaching examples', () => {
  assert.equal(formatWord(encodeInstruction({ op: 'add', rs: 9, rt: 10, rd: 8 })), '0x012A4020');
  assert.equal(formatWord(encodeInstruction({ op: 'addi', rs: 9, rt: 8, immediate: 8 })), '0x21280008');
  assert.equal(formatWord(encodeInstruction({ op: 'lw', rs: 9, rt: 8, immediate: 4 })), '0x8D280004');
  assert.equal(formatWord(encodeInstruction({ op: 'sw', rs: 9, rt: 8, immediate: 4 })), '0xAD280004');
  assert.equal(formatWord(encodeInstruction({ op: 'beq', rs: 8, rt: 9, immediate: 3 })), '0x11090003');
});

test('immediate sign extension preserves negative 16-bit values', () => {
  assert.equal(signExtend16(0xff80), -128);
  assert.equal(signExtend16(0x0080), 128);
});

test('load-use hazard freezes PC and IF/ID and inserts one bubble', () => {
  assert.equal(detectLoadUseHazard({ memRead: 1, writeRegister: 8 }, { rs: 8, rt: 9 }), true);
  assert.deepEqual(hazardControls(true), { stall: 1, PCWrite: 0, IFIDWrite: 0, ID_EX_Flush: 1, IF_Flush: 0 });
});

test('forwarding prefers EX/MEM over MEM/WB', () => {
  assert.equal(
    forwardingSelect({
      sourceRegister: 8,
      exMem: { regWrite: true, writeRegister: 8 },
      memWb: { regWrite: true, writeRegister: 8 },
    }),
    '10',
  );
  assert.equal(
    forwardingSelect({
      sourceRegister: 8,
      exMem: { regWrite: false, writeRegister: 8 },
      memWb: { regWrite: true, writeRegister: 8 },
    }),
    '01',
  );
});

test('load-use keeps the consumer in ID, freezes younger IF, and inserts a separate EX bubble', () => {
  const make = (op, reads, wr) => ({ q: { op, reads, wr } });
  const result = schedulePipeline([make('lw', [16], 8), make('add', [8, 9], 10), make('sw', [16, 10], null)]);
  assert.equal(result.rows[1].cells[3], 'ID (המתנה)');
  assert.equal(result.rows[1].cells[4], 'ID');
  assert.equal(result.rows[1].cells[5], 'EX');
  assert.equal(result.rows[2].cells[3], 'IF');
  assert.equal(result.rows[2].cells[4], 'IF (קפוא)');
  assert.equal(result.rows[2].cells[5], 'ID');
  assert.deepEqual(
    result.bubbles.map((x) => x.cycle),
    [4],
  );
});

test('branch resolved in ID flushes one wrong-path fetch and branches to target next cycle', () => {
  const make = (op, reads, wr, taken = false, flush = false) => ({ q: { op, reads, wr }, taken, flush });
  const alu = schedulePipeline([
    make('add', [8, 9], 16),
    make('beq', [16, 0], null, true),
    make('addi', [0], 10, false, true),
    make('sw', [16], null),
  ]);
  assert.equal(alu.rows[1].stallCycles, 1);
  assert.equal(alu.rows[2].cells[4], 'Flush');
  assert.equal(alu.rows[3].cells[5], 'IF');
  const load = schedulePipeline([
    make('lw', [16], 8),
    make('beq', [8, 0], null, true),
    make('addi', [0], 10, false, true),
    make('sw', [16], null),
  ]);
  assert.equal(load.rows[1].stallCycles, 2);
  assert.equal(load.rows[2].cells[5], 'Flush');
  assert.equal(load.rows[3].cells[6], 'IF');
});

test('store updates immutable application state through reducer', () => {
  const store = createStore(initialState);
  store.dispatch({ type: 'state/set', key: 'sequenceCycle', value: 4 });
  assert.equal(store.getState().sequenceCycle, 4);
  assert.equal(reducer(initialState, { type: 'state/set', key: 'unknown', value: 1 }), initialState);
});
