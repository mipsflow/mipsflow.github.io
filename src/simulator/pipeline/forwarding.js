export function forwardingSelect({ sourceRegister, exMem, memWb }) {
  if (!sourceRegister) return '00';
  if (exMem?.regWrite && exMem.writeRegister === sourceRegister) return '10';
  if (memWb?.regWrite && memWb.writeRegister === sourceRegister) return '01';
  return '00';
}
