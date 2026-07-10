const chalk = require("chalk");
const _ = require("lodash");
const path = require("path");
const { InternalFs, ExternalFs, DataCache } = require("@secrez/fs");
const { VaultPermissions } = require("@secrez/core");
const Logger = require("../utils/Logger");
const cliConfig = require("../cliConfig");
const Commands = require("../commands");
const welcome = require("../Welcome");
const AliasManager = require("../utils/AliasManager");
const ContactManager = require("../utils/ContactManager");

class MainPrompt extends require("./CommandPrompt") {
  async init(options) {
    this.secrez = new (require("@secrez/core").Secrez())();
    await this.secrez.init(options.container, options.localDir);
    this.secrez.cache = new DataCache(
      path.join(this.secrez.config.container, "cache"),
      this.secrez
    );
    this.secrez.cache.initEncryption("alias", "contact");
    await this.secrez.cache.load("id");
    this.internalFs = new InternalFs(this.secrez);
    this.externalFs = new ExternalFs(this.secrez);
    this.getReady({
      historyPath: this.secrez.config.historyPath,
      completion: "completion",
      commands: new Commands(this, cliConfig).getCommands(),
    });
    this.cache = {};
    if (options.timeout) {
      this.clearScreenTimeout = options.timeout;
    }
  }

  async preRun(options = {}) {
    if (!this.loggedIn) {
      await welcome.start(this.secrez, options);
      await VaultPermissions.secureVaultIfNeeded(this.secrez.config);
      this.startSigintManager();
      this.internalFs.init().then(() => delete this.showLoading);
      this.loadingMessage = "Initializing";
      await this.loading();
      await this.loadSavedHistory();
      this.loggedIn = true;
      let alerts = this.internalFs.tree.alerts;
      if (alerts.length) {
        Logger.red(alerts[0]);
        Logger.cyan(alerts.slice(1).join("\n"));
      }
      await this.secrez.cache.load("alias");
      await this.secrez.cache.load("contact");
      this.aliasManager = new AliasManager(this.secrez.cache);
      this.contactManager = new ContactManager(this.secrez.cache);
    }
  }

  setCache(name, index, content) {
    if (!this.cache[name]) {
      this.resetCache(name);
    }
    this.cache[name][index] = content;
  }

  resetCache(name) {
    this.cache[name] = {};
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

  prePromptMessage(options = {}) {
    this.resetTimeout();
    return chalk.reset(
      `Secrez ${
        this.internalFs.tree.name
      }:${this.internalFs.tree.workingNode.getPath()}`
    );
  }

  async postRun(options = {}) {
    let cmd = options.cmd;
    let components = cmd.split(" ");
    let command = components[0];
    /* istanbul ignore if  */
    if (!this.basicCommands.includes(command)) {
      command = command.replace(/^\//, "");
      let data = this.aliasManager.get(command);
      if (data) {
        let cmds = data.content.split("&&").map((e) => _.trim(e));
        let max = 0;
        let missing = false;
        for (let i = 0; i < cmds.length; i++) {
          let c = cmds[i];
          let params = c.match(/\$\w{1}/g);
          if (params) {
            for (let p of params) {
              let num = parseInt(p.substring(1));
              max = Math.max(max, num);
              let option = components[num];
              if (!option) {
                missing = true;
              }
              c = c.replace(RegExp("\\$" + num), option);
            }
          }
          if (!missing) {
            Logger.green(">>  " + chalk.bold.grey(c));
            this.disableRun = i !== cmds.length - 1;
            await this.exec([c]);
            if (i === cmds.length - 1) {
              return;
            }
          }
        }
        if (missing) {
          Logger.red(
            `The alias "${command}" requires ${max} parameter${
              max > 1 ? "s" : ""
            }`
          );
          this.disableRun = false;
        }
        this.run();
        return;
      }
      Logger.red("Command not found");
      this.run();
      return;
    }
    await this.exec([cmd]);
    this.previousCommandLine = cmd;
  }
}

module.exports = MainPrompt;
