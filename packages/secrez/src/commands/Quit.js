const utils = require("@secrez/utils");

class Quit extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.quit = utils.sortKeys({
      // dontSaveHistory: TRUE // not supported, yet
    });
    this.cliConfig.completion.help.quit = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: ["Quits Secrez."],
      examples: ["quit"],
    };
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    const wasLoggedIn = Boolean(this.secrez.masterKeyHash);
    /* istanbul ignore if  */
    // eslint-disable-next-line no-constant-condition
    if (process.env.NODE_ENV !== "test") {
      if (wasLoggedIn) {
        await this.prompt.saveHistory();
        this.secrez.signout();
      }
      this.Logger.bold(
        "Clear or close the terminal. If not, your history will be visible scrolling up."
      );
      this.Logger.reset("Bye bye :o)");
      /*eslint-disable-next-line*/
      process.exit(0);
    } else {
      if (wasLoggedIn) {
        this.secrez.signout();
      }
      this.Logger.reset("Bye bye :o)");
    }
  }
}

module.exports = Quit;
