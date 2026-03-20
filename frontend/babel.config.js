module.exports = function (api) {
  api.cache(true);
  const env = process.env.BABEL_ENV || process.env.NODE_ENV || 'development';
  const isTest = env === 'test';

  return {
    presets: isTest ? ['babel-preset-expo'] : ['babel-preset-expo', 'nativewind/babel'],
    plugins: [],
  };
};
