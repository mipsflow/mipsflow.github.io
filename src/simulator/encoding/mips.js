const OPCODES = Object.freeze({ addi: 8, lw: 35, sw: 43, beq: 4, bne: 5 });
const FUNCTS = Object.freeze({ add: 32, sub: 34, and: 36, or: 37, slt: 42 });

export function signExtend16(value) {
  const word = Number(value) & 0xffff;
  return word & 0x8000 ? word - 0x10000 : word;
}

export function encodeInstruction({ op, rs = 0, rt = 0, rd = 0, immediate = 0, target = 0 }) {
  let word;
  if (Object.hasOwn(FUNCTS, op)) word = (rs << 21) | (rt << 16) | (rd << 11) | FUNCTS[op];
  else if (Object.hasOwn(OPCODES, op))
    word = (OPCODES[op] << 26) | (rs << 21) | (rt << 16) | (immediate & 0xffff);
  else if (op === 'j') word = (2 << 26) | ((target >>> 2) & 0x03ffffff);
  else throw new Error(`Unsupported MIPS instruction: ${op}`);
  return word >>> 0;
}

export function formatWord(value) {
  return `0x${(value >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}
