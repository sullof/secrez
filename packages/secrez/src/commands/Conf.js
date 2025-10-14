const { ConfigUtils } = require("@secrez/core");

const chalk = require("chalk");

class Conf extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.conf = {
      _self: this,
    };
    this.cliConfig.completion.help.conf = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "show",
        alias: "s",
        type: Boolean,
      },
      {
        name: "new-password",
        type: Boolean,
      },
      {
        name: "new-iterations-number",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: [
        "Shows current configuration and allow to change password and number of iterations).",
      ],
      examples: [
        ["conf -s", "shows the general settings"],
        ["conf --new-password", "changes your password"],
        ["conf --new-iterations-number", "changes the number of iterations"],
      ],
    };
  }

  async getAllFactors() {
    let allFactors = {};
    const conf = this.secrez.getConf();
    let keys = conf.data.keys || {};
    for (let authenticator in keys) {
      allFactors[authenticator] = keys[authenticator].type;
    }
    return allFactors;
  }

  async showConf(options) {
    const env = await ConfigUtils.getEnv(this.secrez.config);
    this.Logger.reset(chalk.grey("Container: ") + this.secrez.config.container);
    this.Logger.reset(
      chalk.grey("Number of iterations: ") +
        (env.iterations || chalk.yellow("-- not saved locally --"))
    );
  }

  async saveAndOverwrite(p, spec, content, message) {
    try {
      await this.prompt.commands.rm.rm({
        path: p,
      });
    } catch (e) {}
    let node = await this.prompt.commands.touch.touch({
      path: p,
      content,
      versionIfExists: true,
    });
    this.Logger.reset(
      `For your convenience, ${message} has been saved in main:${node.getPath()}`
    );
  }

  async upgradeAccount(options) {
    let pw = options.newPassword;
    let it = options.newIterationsNumber;
    if (pw && it) {
      throw new Error(
        "Changing password and number of iterations in the same operation not allowed"
      );
    }
    let haveSomeFactors = false;
    if (Object.keys(await this.getAllFactors()).length) {
      haveSomeFactors = true;
    }
    let message =
      "Are you sure you want to upgrade your " +
      (pw ? "password" : "number of iterations") +
      "?";
    let yes = await this.useConfirm({
      message,
      default: false,
    });
    if (yes) {
      if (pw) {
        let oldPassword = await this.useInput({
          message: "Type your existing password",
          type: "password",
        });
        if (oldPassword) {
          if (!(await this.secrez.verifyPassword(oldPassword))) {
            throw new Error("Wrong password. Try again");
          }
          let newPassword = await this.useInput({
            message: "Type your new password",
            type: "password",
          });
          if (newPassword) {
            let password = await this.useInput({
              message: "Retype your password",
              type: "password",
              name: "password",
              validate: (value, exitCode) => {
                if (value === newPassword) {
                  return true;
                } else {
                  return chalk.red(
                    `The two passwords do not match. Try again or cancel typing ${chalk.bold(
                      exitCode
                    )}`
                  );
                }
              },
            });
            if (password) {
              await this.secrez.upgradeAccount(password);
              await this.saveAndOverwrite(
                "main:/.NEW_PASSWORD",
                "password",
                password,
                "the new password"
              );
              this.Logger.reset(
                'In case you have doubts about it, please, "cat" the file and take a look before exiting.'
              );
              if (haveSomeFactors) {
                this.Logger.yellow(
                  "All the second factors have been unregistered."
                );
              }
              return;
            }
          }
        }
      } else if (it) {
        let iterations = await this.useInput({
          message: "Type the new number of iterations",
          name: "password",
          validate: (value, exitCode) => {
            if (/^\d+$/.test(value)) {
              return true;
            } else {
              return chalk.red(
                `Type a valid integer, or cancel typing ${chalk.bold(exitCode)}`
              );
            }
          },
        });
        if (iterations) {
          iterations = parseInt(iterations);
          if (iterations === 0) {
            throw new Error("Invalid number");
          }
          await this.secrez.upgradeAccount(undefined, iterations);
          const env = await ConfigUtils.getEnv(this.secrez.config);
          if (env.iterations) {
            env.iterations = iterations;
            await ConfigUtils.putEnv(this.secrez.config, env);
          }
          this.Logger.reset(
            "The number of iterations has been successfully changed."
          );
          return;
        }
      }
    }
    this.Logger.grey("Operation canceled");
  }

  async conf(options) {
    if (options.show) {
      await this.showConf(options);
    } else if (options.newPassword || options.newIterationsNumber) {
      await this.upgradeAccount(options);
    } else {
      throw new Error('Missing parameters. Run "conf -h" to see examples.');
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);

      // Check for git conflicts before changing password or iterations
      if (options.newPassword || options.newIterationsNumber) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          return;
        }
      }

      await this.conf(options);
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Conf;
