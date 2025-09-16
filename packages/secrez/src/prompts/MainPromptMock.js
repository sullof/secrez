const path = require("path");

const { InternalFs, ExternalFs, DataCache } = require("@secrez/fs");
const inquirerCommandPrompt = require("inquirer-command-prompt");

const cliConfig = require("../cliConfig");
const Commands = require("../commands");

class MainPromptMock {
  async init(options) {
    this.secrez = new (require("@secrez/core").Secrez())();
    await this.secrez.init(options.container, options.localDir);
    this.secrez.cache = new DataCache(path.join(options.container, "cache"));
    this.internalFs = new InternalFs(this.secrez);
    this.externalFs = new ExternalFs(this.secrez);
    this.commands = new Commands(this, cliConfig).getCommands();
    this.commandPrompt = inquirerCommandPrompt;
    this.cache = {};
  }

  setCache(name, index, content) {
    if (!this.cache[name]) {
      this.cache[name] = {};
    }
    this.cache[name][index] = content;
  }

  getCache(name, index) {
    if (!this.cache[name]) {
      return null;
    }
    if (typeof index !== "undefined") {
      return this.cache[name][index];
    } else {
      return this.cache[name];
    }
  }

  setLastPath(path) {
    this.setCache("lastPath", 0, path);
  }

  getLastPath() {
    return this.getCache("lastPath", 0);
  }

  async run(options) {}

  async exec(cmds, noRun) {}

  async loading() {}
}

module.exports = MainPromptMock;
