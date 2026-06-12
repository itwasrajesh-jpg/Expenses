const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes("kotlinVersion = '1.9.24'")) {
      config.modResults.contents = config.modResults.contents.replace(
        "kotlinVersion = '1.9.24'",
        "kotlinVersion = '2.1.21'"
      );
    }
    // Also handle if it's already been partially updated
    if (config.modResults.contents.includes('kotlinVersion = "1.9.24"')) {
      config.modResults.contents = config.modResults.contents.replace(
        'kotlinVersion = "1.9.24"',
        'kotlinVersion = "2.1.21"'
      );
    }
    return config;
  });
};
