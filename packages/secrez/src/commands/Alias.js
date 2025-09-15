const chalk = require("chalk");
const AliasManager = require("../utils/AliasManager");

class Alias extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.alias = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.alias = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "name",
        alias: "n",
        defaultOption: true,
        type: String,
      },
      {
        name: "command-line",
        alias: "c",
        type: String,
      },
      {
        name: "list",
        alias: "l",
        type: Boolean,
      },
      {
        name: "filter",
        alias: "f",
        type: String,
      },
      {
        name: "previous-command",
        alias: "p",
        type: Boolean,
      },
      {
        name: "rename",
        alias: "r",
        type: String,
        multiple: true,
      },
      {
        name: "delete",
        alias: "d",
        type: String,
      },
      {
        name: "skip-confirm",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: [
        "Create aliases of other commands.",
        "Aliases' name are case sensitive. They can be any combination of letters, numerals, underscores and hiphens",
        'If an alias conflicts with a command, you can disambiguate it prefixing it with a slash ("/"). Like calling the alias "mv" as "/mv".',
      ],
      examples: [
        [
          'alias f -c "copy facebook.yml -f email password"',
          'creates an alias "f" that executes "copy facebook.yml -f email password"',
        ],
        [
          "alias g --previous-command",
          'creates the alias "g" using the previous command; this allows you to test something, and when ready generate an alias for it',
        ],
        [
          'alias C -c "copy coinbase.yml -f email password -d 4 && totp coinbase.yml"',
          'creates an alias "C" that copies email and password, and when the comand is executed, runs "totp coinbase.yml" ',
        ],
        [
          'alias m -c "copy $1 -f email password -d4 2 && totp $1"',
          'creates a macro callable like "m coinbase.yml" ',
        ],
        ["alias -l", "lists all the created aliases"],
        [
          "alias -l -f copy",
          'lists the aliases filtering the ones that execute a "copy" command',
        ],
        ["alias -r f fb", 'renames the alias "f" to "fb"'],
        ["alias -d g", 'deletes the alias "g"'],
      ],
    };
  }

  async alias(options) {
    if (!this.aliasManager) {
      this.aliasManager = new AliasManager(this.secrez.cache);
    }
    if (options.previousCommand && options.commandLine) {
      throw new Error("Conflicting parameters");
    }
    if (options.name && (options.previousCommand || options.commandLine)) {
      let error = this.aliasManager.validateName(options.name);
      if (error) {
        throw new Error(error);
      }
      if (this.aliasManager.get(options.name)) {
        throw new Error(`An alias named "${options.name}" already exists`);
      }
      if (!options.commandLine) {
        options.commandLine = // for testing
          process.env.NODE_ENV === "test"
            ? options.previousCommandLine
            : this.prompt.previousCommandLine;
      }
      error = this.aliasManager.validateCommand(
        options.commandLine,
        this.prompt.commands
      );
      if (error) {
        throw new Error(error);
      }
      let yes = options.skipConfirm;
      /* istanbul ignore if  */
      if (!yes) {
        yes = await this.useConfirm({
          message: `Are you sure you want to create the alias ${chalk.cyan(
            options.name
          )} for: \n${chalk.grey(options.commandLine)}\n?`,
          default: false,
        });
      }
      if (yes) {
        if (await this.aliasManager.create(options)) {
          return chalk.grey("The alias has been created");
        }
      } else {
        return chalk.grey("Operation canceled");
      }
    } else if (options.list) {
      let list = [];
      let aliases = this.aliasManager.get();
      let max = 0;
      for (let alias in aliases) {
        let content = aliases[alias].content;
        if (options.filter) {
          if (content.split(" ")[0] !== options.filter) {
            continue;
          }
        }
        list.push([alias, content]);
        max = Math.max(max, alias.length);
      }
      for (let i = 0; i < list.length; i++) {
        list[i] =
          chalk.bold(list[i][0]) +
          " ".repeat(max - list[i][0].length) +
          "  " +
          chalk.reset(list[i][1]);
      }
      return list;
    } else if (options.rename) {
      let [existentName, newName] = options.rename;
      if (!this.aliasManager.get(existentName)) {
        throw new Error(`An alias named "${existentName}" does not exist`);
      }
      if (this.aliasManager.get(newName)) {
        throw new Error(`An alias named "${newName}" already exists`);
      }
      let error = this.aliasManager.validateName(newName);
      if (error) {
        throw new Error(error);
      }
      if (await this.aliasManager.rename(existentName, newName)) {
        return chalk.grey(
          `The alias "${existentName}" has been renamed "${newName}"`
        );
      } else {
        throw new Error(`Could not rename "${existentName}"`);
      }
    } else if (options.delete) {
      let existentName = options.delete;
      if (!this.aliasManager.get(existentName)) {
        throw new Error(`An alias named "${existentName}" does not exist`);
      }
      if (await this.aliasManager.remove(existentName)) {
        return chalk.grey(`The alias "${existentName}" has been removed`);
      } else {
        throw new Error(`Could not remove "${existentName}"`);
      }
    } else {
      throw new Error("Wrong parameters");
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      
      // Check for git conflicts before creating/modifying/deleting aliases
      if (options.commandLine || options.previousCommand || options.rename || options.delete) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }
      
      let result = await this.alias(options);
      if (!Array.isArray(result)) {
        result = [result];
      }
      for (let r of result) {
        this.Logger.reset(r);
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Alias;
