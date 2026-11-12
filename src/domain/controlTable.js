export const controlKeys = [
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
export const officialControlRows = [
  ['R-Type', '0', '1', '0', '0', '1', '0', '0', '0', '1', '0', '0'],
  ['lw', '35', '0', '1', '1', '1', '1', '0', '0', '0', '0', '0'],
  ['sw', '43', 'x', '1', 'x', '0', '0', '1', '0', '0', '0', '0'],
  ['beq', '4', 'x', '0', 'x', '0', '0', '0', '1', '0', '1', '0'],
  ['addi', '8', '0', '1', '0', '1', '0', '0', '0', '0', '0', '0'],
  ['J', '2', 'x', 'x', 'x', '0', '0', '0', 'x', 'x', 'x', '1'],
];
