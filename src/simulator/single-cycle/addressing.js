import { routeInfo } from '../../domain/singleCycle.js';

export function instructionComputed(name) {
  const word = Number.parseInt((routeInfo[name][1].match(/0x[\da-f]+/i) || [])[0] || '0', 16) >>> 0,
    imm = word & 0xffff,
    signed = imm & 0x8000 ? imm - 0x10000 : imm,
    field = word & 0x03ffffff,
    pc4 = 0x00400004;
  return {
    word,
    imm,
    field,
    branchTarget: (pc4 + (signed << 2)) >>> 0,
    jumpTarget: ((pc4 & 0xf0000000) | (field << 2)) >>> 0,
  };
}
