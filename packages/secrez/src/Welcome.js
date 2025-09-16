const chalk = require("chalk");
const inquirer = require("inquirer");
const fs = require("fs-extra");
const Crypto = require("@secrez/crypto");
const Logger = require("./utils/Logger");
// const Fido2Client = require("./utils/Fido2Client"); // FIDO2 support removed

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
      let errorCode = await this.login();
      if (errorCode === 1) {
        await this.handleDeprecatedFido2();
      }
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
          if (e.message === "A second factor is required") {
            return 1;
          }
          Logger.red(`${e.message}.Try again or Ctrl - C to exit.`);
        }
      } catch (e) {
        Logger.red("Unrecognized error. Try again or Ctrl-c to exit.");
      }
    }
  }

  // sharedLogin() method removed - FIDO2 support deprecated
  /*
  async sharedLogin() {
    let fido2Client = new Fido2Client(this.secrez);
    let authenticator;
    let list = await fido2Client.getKeys();
    const conf = await this.secrez.readConf();
    let choices = [];
    for (let authenticator in conf.data.keys) {
      choices.push(authenticator);
    }
    for (;;) {
      if (list.length === 1) {
        authenticator = list[0];
      } else {
        let p = await inquirer.prompt([
          {
            type: "list",
            name: "authenticator",
            message: "Which second factor would you like to use?",
            choices,
          },
        ]);
        authenticator = p.authenticator;
      }
      let secret;
      try {
        try {
          if (fido2Client.keys[authenticator]) {
            Logger.grey("Touch your fido2 authenticator device now...");
            secret = await fido2Client.verifySecret(authenticator);
          } else {
            let exitCode = Crypto.getRandomBase58String(2);
            let p = await inquirer.prompt([
              {
                name: "recoveryCode",
                type: "input",
                message: "Type or paste your recovery code:",
                validate: (value) => {
                  if (value.length) {
                    return true;
                  } else {
                    return `
            Please
            paste
            a
            valid
            recovery
            code
            or
            type ${exitCode}
            to
            choose
            another
            factor.`;
                  }
                },
              },
            ]);
            if (p.recoveryCode === exitCode) {
              continue;
            }
            secret = p.recoveryCode;
          }
          let resCode = await this.secrez.sharedSignin(authenticator, secret);
          if (this.secrez.masterKeyHash) {
            await this.saveIterations();
          }
          if (resCode === 1) {
            Logger.bold(chalk.red("Your data has been upgraded."));
            Logger.red(
              "To avoid conflicts, any registered second factor has been removed."
            );
            Logger.grey("Please, register them again, thanks.");
          }
          return;
        } catch (e) {
          Logger.red(`${e.message}.Try
            again
            or
            Ctrl - C
            to
            exit.`);
        }
      } catch (e) {
        Logger.red("Unrecognized error. Try again or Ctrl-C to exit.");
      }
    }
  }
  */

  async signup() {
    for (;;) {
      try {
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

  async handleDeprecatedFido2() {
    Logger.yellow("FIDO2 second factor authentication is no longer supported in this version.");
    Logger.grey("Removing deprecated FIDO2 configuration...");
    
    try {
      const conf = await this.secrez.readConf();
      const data = conf.data;
      
      if (data.keys) {
        // Remove all FIDO2 keys from the configuration
        delete data.keys;
        
        // Save the cleaned configuration
        await this.secrez.saveConf(conf);
        
        Logger.green("FIDO2 configuration has been removed successfully.");
        Logger.grey("You can now login with your master password only.");
        
        // Try to login again with the cleaned configuration
        let errorCode = await this.login();
        if (errorCode === 1) {
          Logger.red("Login still failed. Please check your password or create a new account.");
          // eslint-disable-next-line no-process-exit
          process.exit(1);
        }
      } else {
        Logger.red("No FIDO2 keys found, but login still requires second factor. This may indicate a corrupted configuration.");
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    } catch (e) {
      Logger.red(`Failed to clean FIDO2 configuration: ${e.message}`);
      Logger.grey("You may need to manually remove the keys.json file and create a new account.");
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }
}

module.exports = new Welcome();
