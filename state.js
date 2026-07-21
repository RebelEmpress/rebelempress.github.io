// Shared mutable game state. All cross-module state lives on this single
// object so any module can read/write it (import { GS } from "./state.js").
export const GS = {};
