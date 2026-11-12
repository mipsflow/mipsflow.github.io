/** Detect the classic in-order load-use dependency that needs one bubble. */
export function detectLoadUseHazard(idEx, ifId) {
  const load = idEx?.memRead === 1;
  const destination = idEx?.writeRegister;
  const usesSource = [ifId?.rs, ifId?.rt].includes(destination);
  return Boolean(load && destination !== 0 && usesSource);
}

/** Return the existing stall/flush control values for the hazard decision. */
export function hazardControls(loadUse, branchTaken = false) {
  if (loadUse) return { stall: 1, PCWrite: 0, IFIDWrite: 0, ID_EX_Flush: 1, IF_Flush: 0 };
  if (branchTaken) return { stall: 0, PCWrite: 1, IFIDWrite: 1, ID_EX_Flush: 0, IF_Flush: 1 };
  return { stall: 0, PCWrite: 1, IFIDWrite: 1, ID_EX_Flush: 0, IF_Flush: 0 };
}
