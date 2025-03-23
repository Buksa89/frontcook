module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ["@babel/plugin-proposal-decorators", { "legacy": true }],
      ["@babel/plugin-transform-class-properties", { "loose": true }],
      "@babel/plugin-transform-nullish-coalescing-operator",
      "@babel/plugin-transform-optional-chaining"
    ]
  };
};