// Shared application state and timers.
import { createStore, initialState } from '../state/store.js';

export const store = createStore(initialState);
export const state = new Proxy(
  {},
  {
    get: (_, key) => store.getState()[key],
    set: (_, key, value) => {
      store.dispatch({ type: 'state/set', key, value });
      return true;
    },
  },
);

export const timers = { timer: null, hoverHideTimer: null, pipeTimer: null };
