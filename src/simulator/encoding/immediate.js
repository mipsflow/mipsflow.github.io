/**
 * Parse a MIPS immediate written in decimal or hexadecimal, with an optional sign.
 * Accepts "8", "-128", "0x400", "-0x400". Returns NaN for anything else.
 */
export function parseImmediate(token) {
  const match = String(token)
    .trim()
    .match(/^([+-]?)(0x[0-9a-f]+|\d+)$/i);
  if (!match) return NaN;
  return (match[1] === '-' ? -1 : 1) * Number(match[2]);
}

/** True when the value fits a signed 16-bit immediate field. */
export function fitsSigned16(value) {
  return Number.isInteger(value) && value >= -32768 && value <= 32767;
}
