const AppError = require("../modules/errorHandling/AppError");

class DependencyContainer {
  constructor() {
    this.dependencies = {};
  }

  register(name, dependency) {
    this.dependencies[name] = dependency;
  }

  getDependency(name) {
    if (!this.dependencies[name]) {
      throw new AppError(`Dependency "${name}" is not registered.`);
    }

    return this.dependencies[name];
  }
}

const dependencyContainer = new DependencyContainer();

module.exports = dependencyContainer;
