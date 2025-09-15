const chalk = require("chalk");
const { yamlStringify } = require("@secrez/utils");

class Git extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.git = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.git = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "status",
        alias: "s",
        type: Boolean,
      }
    ];
  }

  help() {
    return {
      description: [
        "Check a git repository status."
      ],
      examples: [
        [
          "git -s",
          "Check the git repository status",
        ]
      ],
    };
  }

  async git(options = {}) {
    // here we must put the logic of the command
    // if options.status is true, we must check the git repository status
    // if options.check is true, we must check for remote changes and potential conflicts
    let result;
    const isGit = await this.internalFs.gitConflictChecker.isGitRepository();
    if (isGit) {
        if (options.status) {
            let status = await this.internalFs.gitConflictChecker.getGitStatus();
            let warning = await this.internalFs.gitConflictChecker.getWarningMessage(status);
            if (warning) {
              return chalk.yellow(warning);
            } else return "No remote changes found.";
        }
    } else {
        return "Not a git repository";
    }
  }


  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      let result = await this.git(options);
      this.Logger.reset(result);
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }

}

module.exports = Git;
