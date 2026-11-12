import { hazardControls } from './hazardDetection.js';

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];

/**
 * Schedule an in-order, five-stage MIPS pipeline with forwarding.
 * Conditional branches resolve in ID: ALU→branch needs one stall, load→branch two.
 * A taken branch's wrong-path fetch is supplied as a `{ flush: true }` record.
 */
export function schedulePipeline(records) {
  let fetchCycle = 1;
  let inheritedStall = 0;
  let branchResolutionCycle = null;
  const scheduled = [];
  const bubbles = [];
  const producers = [];

  for (const record of records) {
    if (record.flush) {
      const cycle = branchResolutionCycle ?? fetchCycle;
      scheduled.push({ ...record, cycles: { IF: cycle }, cells: { [cycle]: 'Flush' } });
      fetchCycle = cycle + 1;
      inheritedStall = 0;
      branchResolutionCycle = null;
      continue;
    }

    const readStage = ['beq', 'bne'].includes(record.q.op) ? 'ID' : 'EX';
    const readOffset = readStage === 'ID' ? 1 : 2;
    let stallCycles = 0;
    for (const producer of producers) {
      if (producer.q.wr == null || producer.q.wr === 0 || !record.q.reads.includes(producer.q.wr)) continue;
      const availableCycle = producer.q.op === 'lw' ? producer.cycles.MEM + 1 : producer.cycles.EX + 1;
      stallCycles = Math.max(stallCycles, availableCycle - (fetchCycle + inheritedStall + readOffset));
    }
    stallCycles = Math.max(0, stallCycles);

    const cycles = {
      IF: fetchCycle,
      ID: fetchCycle + 1 + inheritedStall + stallCycles,
      EX: fetchCycle + 2 + inheritedStall + stallCycles,
      MEM: fetchCycle + 3 + inheritedStall + stallCycles,
      WB: fetchCycle + 4 + inheritedStall + stallCycles,
    };
    const cells = {};
    cells[cycles.IF] = 'IF';
    const firstIdCycle = fetchCycle + 1 + inheritedStall;
    for (let cycle = fetchCycle + 1; cycle < firstIdCycle; cycle++) cells[cycle] = 'IF (קפוא)';
    for (let cycle = firstIdCycle; cycle <= cycles.ID; cycle++) {
      cells[cycle] = cycle === cycles.ID ? 'ID' : 'ID (המתנה)';
    }
    for (const stage of ['EX', 'MEM', 'WB']) cells[cycles[stage]] = stage;
    for (let i = 0; i < stallCycles; i++) {
      bubbles.push({ cycle: firstIdCycle + 1 + i, label: 'ID/EX.Flush · בועה' });
    }

    const item = { ...record, cycles, cells, stallCycles, controls: hazardControls(stallCycles > 0) };
    scheduled.push(item);
    if (record.q.wr != null && record.q.wr !== 0) producers.push(item);
    branchResolutionCycle = readStage === 'ID' ? cycles.ID : null;
    fetchCycle = fetchCycle + 1 + inheritedStall;
    inheritedStall = stallCycles;
  }

  const cycles = Math.max(
    0,
    ...scheduled.flatMap((row) => Object.keys(row.cells).map(Number)),
    ...bubbles.map((x) => x.cycle),
  );
  return { rows: scheduled, bubbles, stages: STAGES, cycles };
}
