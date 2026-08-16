module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already wires up Reanimated / worklets; NativeWind only needs
    // the jsxImportSource plus its own preset for `className` on host components.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
