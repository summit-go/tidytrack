export const sessionStore = {
  async get() {
    try { const v = localStorage.getItem('tidytrack_session'); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  async set(v) { try { localStorage.setItem('tidytrack_session', JSON.stringify(v)); } catch {} },
  async clear() { try { localStorage.removeItem('tidytrack_session'); } catch {} }
};
