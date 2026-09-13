'use strict';

const LOCALES = ['ka', 'en'];

let current = 'ka';
const listeners = new Set();
let persist = async () => {};

function emit() {
  listeners.forEach((listener) => listener());
}

function isWorldLocale(value) {
  return LOCALES.includes(value);
}

function subscribeWorldLocale(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getWorldLocale() {
  return current;
}

function setWorldLocale(next) {
  const loc = isWorldLocale(next) ? next : 'ka';
  if (loc === current) return current;
  current = loc;
  void persist(loc);
  emit();
  return current;
}

function hydrateWorldLocale(value) {
  if (!isWorldLocale(value)) return current;
  if (value === current) return current;
  current = value;
  emit();
  return current;
}

function registerWorldLocalePersist(fns) {
  persist = typeof fns?.set === 'function' ? fns.set : persist;
  if (typeof fns?.get === 'function') {
    void Promise.resolve(fns.get()).then((raw) => {
      if (isWorldLocale(raw)) hydrateWorldLocale(raw);
    });
  }
}

module.exports = {
  WORLD_LOCALE_KEY: 'medicard.mediWorld.locale',
  hydrateWorldLocale,
  getWorldLocale,
  setWorldLocale,
  subscribeWorldLocale,
  registerWorldLocalePersist,
};
