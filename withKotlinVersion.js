const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    
    // Fix 1: Replace any 1.9.x kotlin version in ext block
    contents = contents.replace(
      /kotlinVersion\s*=\s*['"]1\.9\.[^'"]+['"]/g,
      "kotlinVersion = '2.1.21'"
    );
    
    // Fix 2: Replace kotlin version in buildscript dependencies
    contents = contents.replace(
      /org\.jetbrains\.kotlin:kotlin-gradle-plugin:['"']1\.9\.[^'"]+['"]/g,
      "org.jetbrains.kotlin:kotlin-gradle-plugin:'2.1.21'"
    );

    // Fix 3: If kotlinVersion property doesn't exist in ext block, add it
    if (!contents.includes('kotlinVersion')) {
      contents = contents.replace(
        'ext {',
        "ext {\n        kotlinVersion = '2.1.21'"
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
