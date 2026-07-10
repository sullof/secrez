const chalk = require("chalk");
const inquirer = require("inquirer");
const fs = require("fs-extra");
const Crypto = require("@secrez/crypto");
const Logger = require("./utils/Logger");

const LOW_ITERATIONS_WARNING_THRESHOLD = 100000;

class Welcome {
  async start(secrez, options) {
    this.secrez = secrez;
    this.options = options;
    this.iterations = options.iterations || (await this.getIterations());
    if (await fs.pathExists(this.secrez.config.oldKeysPath)) {
      const oldConf = require(this.secrez.config.oldKeysPath);
      if (!oldConf.data.why) {
        Logger.red(
          chalk.bold(`
Your encrypted db is not compatible with this version of Secrez.
`)
        );
        Logger.reset(`Install secrez-migrate with

  ${chalk.bold("pnpm i -g @secrez/migrate")}

and run it to migrate the db. If you specify the container launching secrez, specify it also launching secrez-migrate. 
If you need to access your secrets now, revert to a compatible version with 

  ${chalk.bold("pnpm i -g secrez@0.10.8")}
  
and migrate your db later.
Thanks.`);
        // eslint-disable-next-line no-process-exit
        process.exit(0);
      }
    }

    if (await fs.pathExists(this.secrez.config.keysPath)) {
      await this.login();
    } else {
      Logger.grey("Please signup to create your local account");
      await this.signup();
    }
  }

  async getIterations() {
    if (await fs.pathExists(this.secrez.config.envPath)) {
      let env = require(this.secrez.config.envPath);
      if (env.iterations) {
        return env.iterations;
      }
    }
    let { iterations } = await inquirer.prompt([
      {
        name: "iterations",
        type: "input",
        message: "Type the number of iterations for password derivation:",
        validate: (value) => {
          if (value.length && parseInt(value) > 0) {
            return true;
          } else {
            return "Please enter a valid number of iterations.";
          }
        },
      },
    ]);
    return parseInt(iterations);
  }

  async confirmLowIterations(iterations) {
    if (iterations >= LOW_ITERATIONS_WARNING_THRESHOLD) {
      return true;
    }
    Logger.yellow(
      chalk.bold(`
Warning: you chose fewer than ${LOW_ITERATIONS_WARNING_THRESHOLD.toLocaleString()} iterations.
`)
    );
    Logger.yellow(
      `Secrez does not salt the KDF with the password alone: the iteration count is mixed into the salt, which makes offline attacks significantly slower than with a typical password-only salt.

We recommend 500,000–1,000,000 iterations for most setups. A random per-account salt is planned for a future release.`
    );
    const { proceed } = await inquirer.prompt([
      {
        name: "proceed",
        type: "confirm",
        message: "Continue signup with this iteration count?",
        default: false,
      },
    ]);
    return proceed;
  }

  // chimney piano fabric forest curious black hip axis story stool spoil fold
  async saveIterations() {
    if (this.options.saveIterations) {
      await this.secrez.saveIterations(this.iterations);
    }
  }

  async login() {
    for (;;) {
      try {
        let { password } = await inquirer.prompt([
          {
            name: "password",
            type: "password",
            message: "Enter your master password:",
            validate: (value) => {
              if (value.length) {
                return true;
              } else {
                return "Please enter your master password.";
              }
            },
          },
        ]);
        try {
          await this.secrez.signin(password, this.iterations);
          if (this.secrez.masterKeyHash) {
            await this.saveIterations();
          }
          return 0;
        } catch (e) {
          Logger.red(`${e.message}.Try again or Ctrl - C to exit.`);
        }
      } catch (e) {
        Logger.red("Unrecognized error. Try again or Ctrl-c to exit.");
      }
    }
  }

  async signup() {
    for (;;) {
      try {
        if (!(await this.confirmLowIterations(this.iterations))) {
          delete this.options.iterations;
          this.iterations = await this.getIterations();
          continue;
        }
        let p = await inquirer.prompt([
          {
            name: "password",
            type: "password",
            message: "Enter your password:",
            validate: (value) => {
              if (value.length) {
                return true;
              } else {
                return "Please enter your password";
              }
            },
          },
          {
            name: "retype",
            type: "password",
            message: "Retype your password:",
            validate: (value) => {
              if (value.length) {
                return true;
              } else {
                return "Please enter your password";
              }
            },
          },
        ]);
        if (p.password === p.retype) {
          try {
            await this.secrez.signup(p.password, this.iterations);
            await this.saveIterations();
            return;
          } catch (e) {
            Logger.red(e.message);
            break;
          }
        } else {
          Logger.red("The two passwords do not match. Try again");
        }
      } catch (e) {
        Logger.red("Unrecognized error. Try again or Ctrl-c to exit.");
      }
    }
  }
}

const welcome = new Welcome();
welcome.LOW_ITERATIONS_WARNING_THRESHOLD = LOW_ITERATIONS_WARNING_THRESHOLD;

module.exports = welcome;
