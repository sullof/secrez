const { chalk } = require("./utils/Logger");
const Crypto = require("@secrez/crypto");
const { editInMemory } = require("./editor/MemoryEditor");

class PreCommand {
  async useEditor(options) {
    if (this.prompt.editorProvider) {
      return this.prompt.editorProvider(options);
    } /* istanbul ignore next */ else {
      const rl = this.prompt.getRl && this.prompt.getRl();
      if (rl) {
        rl.pause();
      }

      try {
        return await editInMemory(options.content || "");
      } finally {
        if (rl) {
          rl.resume();
        }
      }
    }
  }

  async useSelect(options) {
    let cancel = "(cancel)";
    if (!options.dontCancel) {
      options.choices = options.choices.concat([cancel]);
    }
    let { result } = await this.prompt.inquirer.prompt([
      {
        type: "list",
        name: "result",
        message: options.message,
        choices: options.choices,
      },
    ]);
    if (result === cancel) {
      return;
    } else {
      return result;
    }
  }

  async useConfirm(options) {
    let { result } = await this.prompt.inquirer.prompt([
      {
        type: "confirm",
        name: "result",
        message: options.message,
        default: options.default,
      },
    ]);
    return result;
  }

  async useInput(options) {
    let prompt = this.prompt;
    let exitCode = Crypto.getRandomBase58String(2);
    let { result } = await prompt.inquirer.prompt([
      {
        type: options.type || "input",
        name: "result",
        message: options.message,
        default: options.content,
        choices: options.choices,
        validate: (val) => {
          if (val) {
            if (val === exitCode) {
              return true;
            } else if (options.validate) {
              return options.validate(val, exitCode);
            } else if (val.length) {
              return true;
            }
          }
          return chalk.grey(
            `Please, type the ${options.name}, or cancel typing ${chalk.bold(
              exitCode
            )}`
          );
        },
      },
    ]);
    if (result !== exitCode) {
      return result;
    }
  }
}

module.exports = PreCommand;
