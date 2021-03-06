'use strict';

module.exports = class WatchMissingNodeModulesPlugin {
  constructor(nodeModulesPath) {
    this.nodeModulesPath = nodeModulesPath;
  }

  apply(compiler) {
    compiler.hooks.emit.tap('WatchMissingNodeModulesPlugin', compilation => {
      let missingDeps = Array.from(compilation.missingDependencies);
      let nodeModulesPath = this.nodeModulesPath;

      // If any missing files are expected to appear in node_modules...
      if (missingDeps.some(file => file.includes(nodeModulesPath))) {
        // ...tell webpack to watch node_modules recursively until they appear.
        compilation.contextDependencies.add(nodeModulesPath);
      }
    })
  }
}