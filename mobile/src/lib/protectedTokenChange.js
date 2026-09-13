'use strict';

const { shouldInvalidateHealthPullOnTokenReplace } = require('./healthPullCache.js');

const listeners = new Set();

function subscribeProtectedTokenChange(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyProtectedTokenReplace(previous, next) {
  if (!shouldInvalidateHealthPullOnTokenReplace(previous, next)) return false;
  listeners.forEach((listener) => {
    listener();
  });
  return true;
}

module.exports = {
  subscribeProtectedTokenChange,
  notifyProtectedTokenReplace,
};
