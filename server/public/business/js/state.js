// MEDIBOOK business panel — who is signed in and which business is open.
import { get } from '/app/js/api.js';

const BUSINESS_KEY = 'medicard.business.current';
const listeners = new Set();

export const state = {
  user: null,
  memberships: [],
  claims: [],
  mapboxToken: '',
  /** The open business: { business, role, staffId } or null. */
  current: null,
  loaded: false,
};

export function onState(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn(state)); }

function rememberBusiness(id) {
  try { if (id) localStorage.setItem(BUSINESS_KEY, id); else localStorage.removeItem(BUSINESS_KEY); } catch { /* private mode */ }
}

/** Loads my businesses and claims; keeps the last opened business when it is still mine. */
export async function loadState() {
  const me = await get('/api/business/me');
  state.user = me.user;
  state.memberships = me.memberships || [];
  state.claims = me.claims || [];
  state.mapboxToken = me.mapboxToken || '';
  let wanted = null;
  try { wanted = localStorage.getItem(BUSINESS_KEY); } catch { wanted = null; }
  const found = state.memberships.find((m) => m.business.id === wanted) || state.memberships[0] || null;
  state.current = found;
  rememberBusiness(found?.business.id || null);
  state.loaded = true;
  emit();
  return state;
}

export function switchBusiness(id) {
  const next = state.memberships.find((m) => m.business.id === id);
  if (!next) return;
  state.current = next;
  rememberBusiness(id);
  emit();
}

export function currentId() { return state.current?.business?.id || null; }
export function role() { return state.current?.role || null; }
export function canManage() { return role() === 'OWNER' || role() === 'MANAGER'; }
export function isOwner() { return role() === 'OWNER'; }

export function clearState() {
  state.user = null;
  state.memberships = [];
  state.claims = [];
  state.current = null;
  state.loaded = false;
  rememberBusiness(null);
  emit();
}
