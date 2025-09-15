const { chalk } = require("./utils/Logger");
const Logger = require("./utils/Logger");
const cliConfig = require("./cliConfig");
const PreCommand = require("./PreCommand");

class Command extends PreCommand {
  constructor(prompt) {
    super();
    this.prompt = prompt;
    this.secrez = prompt.secrez;
    this.optionDefinitions = [];
    this.cliConfig = cliConfig;
    this.internalFs = prompt.internalFs;
    this.externalFs = prompt.externalFs;
    this.Logger = Logger;
    this.chalk = chalk;
  }

  help() {}

  showHelp() {
    let command = this.constructor.name.toLowerCase();
    this.prompt.commands.help.exec({ command });
  }

  setHelpAndCompletion() {}

  getCompletionType(option) {
    if (!this.completionTypes) {
      this.completionTypes = {};
      for (let item of this.optionDefinitions) {
        this.completionTypes[item.name] = item.completionType;
      }
    }
    return this.completionTypes[option];
  }

  selfCompletion(self, extraOptions = {}) {
    return async (options, originalLine, currentOption) => {
      options = Object.assign(options, extraOptions);
      options.forAutoComplete = true;
      let completionType = this.getCompletionType(currentOption);
      /* istanbul ignore if  */
      if (this.customCompletion) {
        let extra = await this.customCompletion(
          options,
          originalLine,
          currentOption
        );
        if (extra) {
          return extra;
        }
      }
      if (completionType === "dataset") {
        let datasetsInfo = await this.internalFs.getDatasetsInfo();
        options.forAutoComplete = true;
        if (options.dataset) {
          return datasetsInfo
            .map((e) => e.name)
            .filter((e) => RegExp("^" + options.dataset).test(e));
        } else {
          return datasetsInfo.map((e) => e.name);
        }
      }
      if (
        (process.env.NODE_ENV === "test" && currentOption === "path") ||
        completionType === "file"
      ) {
        if (options[currentOption] === null) {
          delete options[currentOption];
        }
        if (currentOption !== "path") {
          options.path = options[currentOption];
        }
        if (
          self.prompt.cache &&
          self.prompt.cache.findResult &&
          /^(#|£)\d+$/.test(options.path)
        ) {
          return [
            options.path +
              self.prompt.cache.findResult[
                options.path.replace(/^(#|£)/, "")
              ][1] || undefined,
          ];
        }
        return await self.prompt[
          extraOptions.external ? "externalFs" : "internalFs"
        ].getFileList(options, true);
      } else {
        return [];
      }
    };
  }

  threeRedDots(large) {
    return chalk.cyan(large ? "•••" : "···");
  }

  checkPath(options) {
    if (typeof options.path !== "string" || !options.path) {
      throw new Error("A valid path is required");
    }
  }

  validate(options, mandatoryOptions) {
    if (options._unknown) {
      throw new Error(
        `Unknown option: ${options._unknown} ` +
          chalk.grey(
            `(run "${this.constructor.name.toLowerCase()} -h" for help)`
          )
      );
    }
    if (
      options.path &&
      (/^(#|£)\d+\//.test(options.path) || /^(#|£)\d+\w+:\//.test(options.path))
    ) {
      options.path = options.path.replace(/^(#|£)\d+/, "");
    }
    if (mandatoryOptions) {
      let err = "";
      let prefix = "Missing options: ";
      for (let o in mandatoryOptions) {
        if (!options[o]) {
          err += (err ? ", " : "") + o;
        }
      }
      if (err) {
        throw new Error(prefix + err);
      }
    }
  }

  /**
   * Check for git conflicts before performing data-changing operations
   * Returns true if the operation should proceed, false if it should be cancelled
   */
  async checkGitConflictsBeforeOperation() {
    try {
      const conflictCheck = await this.internalFs.checkGitSyncStatus();
      
      if (conflictCheck.hasRisk) {
        // Show the warning message
        this.Logger.yellow(conflictCheck.message);
        
        // Ask user if they want to continue
        const shouldContinue = await this.useInput({
          type: "confirm",
          message: "Do you want to continue anyway?",
          default: false
        });
        
        if (!shouldContinue) {
          this.Logger.grey("Operation cancelled.");
          return false;
        }
      }
      
      return true;
    } catch (e) {
      // If git check fails, log a warning but continue
      this.Logger.yellow("Warning: Could not check git status. Proceeding anyway.");
      return true;
    }
  }
}

module.exports = Command;
