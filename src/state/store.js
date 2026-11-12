export const initialState = Object.freeze({
  inst: 0,
  step: 0,
  mode: 'manual',
  showAllRoutes: true,
  infoPinned: false,
  cpuArchitecture: 'single',
  pipeStep: 0,
  pipeInst: 0,
  hazardDemo: 'none',
  sequenceIndex: 0,
  sequenceCycle: 1,
});

export function reducer(state, action) {
  switch (action.type) {
    case 'state/set':
      if (!Object.hasOwn(state, action.key)) return state;
      return { ...state, [action.key]: action.value };
    case 'state/patch':
      return { ...state, ...action.patch };
    case 'state/reset':
      return { ...initialState };
    default:
      return state;
  }
}

export function createStore(seed = initialState) {
  let state = { ...seed };
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return state;
      state = next;
      listeners.forEach((listener) => listener(state, action));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
