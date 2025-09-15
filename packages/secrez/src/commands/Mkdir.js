const { config, Entry } = require("@secrez/core");

class Mkdir extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.mkdir = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.mkdir = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "path",
        completionType: "file",
        alias: "p",
        defaultOption: true,
        type: String,
      },
    ];
  }

  help() {
    return {
      description: ["Creates a directory."],
      examples: [
        "mkdir cryptos",
        "mkdir coin/tron/wallet",
        "mkdir ../other\\ people",
        'mkdir "super folder"',
      ],
    };
  }

  async mkdir(options = {}) {
    this.checkPath(options);
    options.type = config.types.DIR;
    return await this.internalFs.make(options);
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      this.checkPath(options);

      // Check for git conflicts before creating directories
      if (!options.help) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }

      let data = await this.internalFs.getTreeIndexAndPath(options.path);
      let sanitizedPath = Entry.sanitizePath(data.path);
      if (sanitizedPath !== data.path) {
        throw new Error("A filename cannot contain \\/><|:&?*^$ chars.");
      }
      await this.mkdir(options);
      this.Logger.grey(`New folder "${options.path}" created.`);
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Mkdir;
