const chalk = require("chalk");
const _ = require("lodash");
const fs = require("fs-extra");
const inquirer = require("inquirer");

// eslint-disable-next-line node/no-unpublished-require
// const inquirerCommandPrompt = require('../../../../../inquirer-command-prompt')
const inquirerCommandPrompt = require("inquirer-command-prompt");
const multiEditorPrompt = require("./MultiEditorPrompt");
inquirer.registerPrompt("command", inquirerCommandPrompt);
inquirer.registerPrompt("multiEditor", multiEditorPrompt);

const { sleep, getKeyValue } = require("@secrez/utils");
const Completion = require("./Completion");
const { FsUtils } = require("@secrez/fs");
const Logger = require("../utils/Logger");
const cliConfig = require("../cliConfig");
const sigintManager = require("./SigintManager");

let thiz;

class CommandPrompt {
  constructor() {
    this.timeoutId = null;
    this.clearScreenTimeout = 180;
  }

  clearScreen() {
    process.stdout.write("\u001b[2J\u001b[0;0H");
    process.stdout.write(
      `Screen cleared. Press any key to reactivate the terminal`
    );
  }

  resetTimeout() {
    const s = 180000;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      this.clearScreen();
    }, this.clearScreenTimeout * 1000);
  }

  async getReady(options) {
    thiz = this;
    this.inquirer = inquirer;
    this.commandPrompt = inquirerCommandPrompt;
    this.historyPath = options.historyPath;
    inquirerCommandPrompt.setConfig({
      history: {
        save: false,
        limit: 100,
      },
      onCtrlEnd: thiz.reorderCommandLineWithDefaultAtEnd,
    });
    this.completion = cliConfig[options.completion];
    this.commands = options.commands;
    this.environment = options.environment;
    this.context = options.context || 0;
    await this.setSigintPosition();
  }

  async setSigintPosition() {
    const { position, runNow } = await sigintManager.setPosition(this);
    this.sigintPosition = position;
    if (runNow) {
      await this.run();
    }
  }

  startSigintManager() {
    sigintManager.start();
  }

  async firstRun() {
    if (!this.getCommands) {
      this.getCommands = Completion(this.completion);
      this.basicCommands = await this.getCommands();
      this.getCommands.bind(this);
    }
  }

  reorderCommandLineWithDefaultAtEnd(line) {
    // reorder the line to put autocompletable words at the end of the line
    let previousLine = line;
    line = _.trim(line).split(" ");
    let cmd = line[0];
    if (cmd && thiz.commands[cmd]) {
      let definitions = thiz.commands[cmd].optionDefinitions;
      let def = {};
      let selfCompletables = 0;
      for (let d of definitions) {
        def[d.name] = d;
        if (d.defaultOption || d.isCompletable) selfCompletables++;
      }
      let params = FsUtils.parseCommandLine(
        definitions,
        line.slice(1).join(" ")
      );
      let result = [];
      for (let key in params) {
        if (key !== "_unknown") {
          result.push(getKeyValue(params, key));
        }
      }
      result.sort((a, b) => {
        let A = def[a.key];
        let B = def[b.key];
        return A.defaultOption
          ? 1
          : B.defaultOption
          ? -1
          : A.isCompletable
          ? 1
          : B.isCompletable
          ? -1
          : 0;
      });
      let ret = [cmd];
      for (let c of result) {
        if (!def[c.key].defaultOption) {
          if (ret.length && /^-/.test(ret[ret.length - 1])) {
            ret[ret.length - 1] += def[c.key].alias;
          } else {
            ret.push("-" + def[c.key].alias);
          }
        }
        if (def[c.key].type !== Boolean) {
          ret.push(c.value);
        }
      }
      if (selfCompletables === 2 && previousLine === ret.join(" ")) {
        let len = ret.length;
        if (len > 3) {
          ret = ret
            .slice(0, len - 3)
            .concat(ret.slice(len - 1, len))
            .concat(ret.slice(len - 3, len - 1));
        }
      }
      return ret.join(" ");
    } else {
      return "";
    }
  }

  async saveHistory() {
    let histories = JSON.stringify(inquirerCommandPrompt.getHistories(true));
    let encryptedHistory = this.secrez.encryptData(histories);
    await fs.writeFile(this.historyPath, encryptedHistory);
  }

  async loadSavedHistory() {
    let previousHistories;
    if (await fs.pathExists(this.historyPath)) {
      let encryptedHistory = await fs.readFile(this.historyPath, "utf8");
      previousHistories = JSON.parse(this.secrez.decryptData(encryptedHistory));
      inquirerCommandPrompt.setHistoryFromPreviousSavedHistories(
        previousHistories
      );
    }
  }

  async loading() {
    this.loadingIndex = 0;
    this.showLoading = true;
    await sleep(100);
    while (this.showLoading) {
      const loader = ["\\", "|", "/", "-"];
      this.loadingIndex = (this.loadingIndex + 1) % 4;
      process.stdout.write(
        loader[this.loadingIndex] + " " + this.loadingMessage
      );
      await sleep(100);
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
    }
  }

  short(l, m) {
    let res = [];
    if (l) {
      l = _.trim(l);
      let r = l.split("/");
      if (r.length !== 1) {
        r.pop();
        r = r.join("/") + "/";
      } else {
        r = l.split(" ");
        if (r.length !== 1) {
          r.pop();
          r = r.join(" ") + " ";
        } else {
          r = l;
        }
      }
      for (let i = 0; i < m.length; i++) {
        try {
          if (m[i] !== l) {
            if (r !== l) {
              m[i] = m[i].replace(RegExp("^" + r), "");
            }
            if (m[i]) {
              res.push(m[i].replace(/^(-[a-zA-Z]{1} |--\w+(=| ))/, ""));
            }
          }
        } catch (e) {}
      }
    }
    return res;
  }

  async preRun(options) {
    // can be implemented by the extending class
  }

  async postRun(options) {
    // must be implemented by the extending class
  }

  prePromptMessage() {
    return "MainPrompt";
  }

  promptMessage() {
    return "$";
  }

  availableOptionsMessage(options) {
    return chalk.grey("Available options:");
  }

  noColorOnAnswered() {
    return false;
  }

  colorOnAnswered() {
    return "grey";
  }

  onBeforeRewrite(line) {
    if (/ (#|£)\d+(\w+:|)\/[\w/]+/.test(line)) {
      line = line.replace(/ (#|£)\d+((\w+:|)\/[\w/]+)/, " $2");
    }
    // Handle < syntax for last path
    if (/ </.test(line)) {
      line = line.replace(/</, "");
    }
    return line;
  }

  async run(options = {}) {
    await this.firstRun();
    await this.preRun(options);
    if (this.disableRun) {
      return;
    }
    try {
      let prefix = (this.lastPrefix = this.prePromptMessage(options));
      let { cmd } = await inquirer.prompt([
        {
          type: "command",
          name: "cmd",
          autoCompletion: this.getCommands,
          short: this.short,
          prefix,
          noColorOnAnswered: this.noColorOnAnswered(),
          colorOnAnswered: this.colorOnAnswered(),
          message: this.promptMessage(),
          ellipsize: true,
          autocompletePrompt: this.availableOptionsMessage(),
          onBeforeKeyPress: undefined,
          onBeforeRewrite: this.onBeforeRewrite,
          context: this.context,
          onClose: () => {
            fs.emptyDirSync(this.secrez.config.tmpPath);
          },
          validate: (val) => {
            return val ? true : chalk.grey("Press TAB for suggestions.");
          },
        },
      ]);
      options.cmd = _.trim(cmd);
      await this.postRun(options);
    } catch (e) {
      console.error(e);
      Logger.red(e.message);
    }
  }

  getRl() {
    return inquirerCommandPrompt.getRl();
  }

  async exec(cmds, noRun) {
    for (let cmd of cmds) {
      if (cmd) {
        cmd = cmd.split(" ");
        const command = cmd[0];
        if (this.basicCommands.includes(command)) {
          let commandLine = cmd.slice(1).join(" ");
          if (!commandLine) {
            // prevent command-line-args from parsing process.argv
            commandLine = " ";
          }
          try {
            const options = FsUtils.parseCommandLine(
              this.commands[command].optionDefinitions,
              commandLine,
              true
            );
            await this.commands[command].exec(options);
          } catch (e) {
            // console.error(e)
            Logger.red(e.message);
            await this.run();
          }
        } else {
          Logger.red("Command not found");
          if (!noRun) {
            await this.run();
          }
        }
      }
    }
  }
}

module.exports = CommandPrompt;
