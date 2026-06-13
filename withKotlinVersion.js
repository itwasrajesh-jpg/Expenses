const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    // Replace any 1.9.x kotlin version with 2.0.21
    contents = contents.replace(
      /kotlinVersion\s*=\s*['"]1\.[0-9]+\.[0-9]+['"]/g,
      "kotlinVersion = '2.0.21'"
    );
    config.modResults.contents = contents;
    return config;
  });
};
