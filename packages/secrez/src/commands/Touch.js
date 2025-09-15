const { config, Entry } = require("@secrez/core");
const { yamlStringify } = require("@secrez/utils");
const { newWallet, getWalletFromMnemonic } = require("@secrez/eth");
const { Node } = require("@secrez/fs");

class Touch extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.touch = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.touch = true;
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
      {
        name: "content",
        alias: "c",
        type: String,
      },
      {
        name: "prefix",
        alias: "x",
        type: String,
      },
      {
        name: "wait-for-content",
        alias: "w",
        type: Boolean,
      },
      {
        name: "not-visible-content",
        alias: "n",
        type: Boolean,
      },
      {
        name: "generate-wallet",
        alias: "g",
        type: Boolean,
      },
      {
        name: "amount",
        alias: "a",
        type: Number,
      },
      {
        name: "include-mnemonic",
        alias: "m",
        type: Boolean,
      },
      {
        name: "version-if-exists",
        alias: "v",
        type: Boolean,
      },
      {
        name: "from",
        type: String,
        completionType: "file",
      },
    ];
  }

  help() {
    return {
      description: [
        "Creates a file.",
        'Compared with Unix "touch" command, it can create a file with content',
        'Check also "help create" for more options.',
      ],
      examples: [
        [
          "touch somefile",
          "If the the file exists, it create 'somefile.2', 'somefile.3', etc.",
        ],
        [
          'touch -p afile --content "Password: 1432874565"',
          "Save the specified content in 'afile'.",
        ],
        [
          "touch sample.txt -w",
          "Prompt the user to type the content of the file. The text cannot contain newlines. It will cut at the first one, if so. If '-w' and '-c' are both present, '-c' will be ignored.",
        ],
        [
          "touch walletPassword -n",
          "Prompt the user to type the password without showing it. Notice that '-n' has priority on '-w' and '-c'",
        ],
        [
          "touch gilbert -f name -c 'Albert Goose'",
          "If the file does not exists, it creates 'gilbert.yaml' with the field 'name'. If a yaml file exists, it adds the field 'name' to it if the the field does not exist.",
        ],
        [
          "touch new-wallet -g",
          "Creates a new wallet file containing 'private_key' and `address`. Wallet has priority on other creation options.",
        ],
        [
          "touch new-wallets.yaml -g --amount 3",
          "Creates 'new-wallets.yaml', containing 3 wallet, calling them 'private_key', `private_key2` and `private_key3`, and relative addresses.",
        ],
        [
          "touch new-wallet --generate-wallet -x trust0",
          "In combination con '-x', it creates a new wallet file calling the fields 'trust0_private_key' and 'trust0_address'.",
        ],
        [
          "touch new-wallets.yaml -gi",
          "Includes the mnemonic. In this case, it will also add the fields 'mnemonic' (mnemonic phrase) and 'derived_path' (path used to generate the keys). ",
        ],
        [
          "touch wallet2.yml --from wallet.yaml",
          "Creates the new file 'wallet2.yml' duplicating 'wallet.yml'.",
        ],
      ],
    };
  }

  async touch(options = {}) {
    this.checkPath(options);
    let data = await this.internalFs.getTreeIndexAndPath(options.path);
    let fileExists = false;
    let node;
    if (options.generateWallet) {
      let content = {};
      let amount = options.amount || 1;
      let wallet = newWallet();
      for (let i = 1; i <= amount; i++) {
        let wallet0;
        if (i === 1) {
          wallet0 = wallet;
        } else {
          wallet0 = getWalletFromMnemonic(
            wallet.mnemonic.phrase,
            wallet.path,
            i - 1
          );
        }
        let field = `${options.prefix ? options.prefix + "_" : ""}private_key${
          i > 1 ? i : ""
        }`;
        content[field] = wallet0.privateKey.replace(/^0x/, "");
        content[field.replace(/private_key/, "address")] = wallet0.address;
        if (i === 1 && options.includeMnemonic) {
          content[field.replace(/private_key/, "mnemonic")] =
            wallet.mnemonic.phrase;
          let derivedPath = wallet.path;
          if (derivedPath.split("/").length === 6) {
            derivedPath = derivedPath.replace(/\/0$/, "");
          }
          content[field.replace(/private_key/, "derived_path")] = derivedPath;
        }
      }
      options.content = yamlStringify(content);
    }
    if (fileExists) {
      await this.internalFs.tree.update(node, options.content);
    } else {
      let sanitizedPath = Entry.sanitizePath(data.path);
      if (sanitizedPath !== data.path) {
        throw new Error("A filename cannot contain \\/><|:&?*^$ chars.");
      }
      options.type = config.types.TEXT;
      return await this.internalFs.make(options);
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      this.checkPath(options);

      // Check for git conflicts before creating/modifying files
      if (!options.help) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }
      /* istanbul ignore if  */
      if (!options.generateWallet) {
        if (options.notVisibleContent) {
          let content = await this.useInput(
            Object.assign(options, {
              type: "password",
              message: "Type the secret",
            })
          );
          if (content) {
            options.content = content;
          } else {
            throw new Error("Command canceled");
          }
        } else if (options.waitForContent) {
          let content = await this.useInput(
            Object.assign(options, {
              type: "input",
              message: "Type/paste the content",
            })
          );
          if (content) {
            options.content = content;
          } else {
            throw new Error("Command canceled");
          }
        } else if (options.from) {
          let data = await this.internalFs.getTreeIndexAndPath(options.from);
          let tree = data.tree;
          let p = tree.getNormalizedPath(data.path);
          let node;
          try {
            node = tree.root.getChildFromPath(p);
          } catch (e) {
            throw new Error(`File "${options.from}" not found.`);
          }
          if (Node.isFile(node)) {
            console.log("is file");
            let details = await tree.getEntryDetails(node);
            options.content = details.content;
          } else {
            throw new Error(`"${options.from}" is not a file.`);
          }
        }
      }
      let newFile = await this.touch(options);
      if (newFile) {
        this.Logger.grey(`New file "${newFile.getPath()}" created.`);
      } else {
        this.Logger.grey(`File "${options.path}" updated.`);
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Touch;
