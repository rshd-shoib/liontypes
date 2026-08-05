/* Tiny event bus ----------------------------------------------------------- */
export function createEmitter() {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt).delete(fn);
    },
    emit(evt, payload) {
      const s = map.get(evt);
      if (!s) return;
      for (const fn of s) {
        try { fn(payload); } catch (e) { console.error(`[bus:${evt}]`, e); }
      }
    },
  };
}
