const _ = require("lodash");
const { chalk } = require("../utils/Logger");
const Case = require("case");
const { Node } = require("@secrez/fs");
const utils = require("@secrez/utils");

class Tag extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.tag = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.tag = true;
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
        name: "list",
        alias: "l",
        type: Boolean,
      },
      {
        name: "global",
        alias: "g",
        type: Boolean,
      },
      {
        name: "show",
        alias: "s",
        multiple: true,
        type: String,
      },
      {
        name: "add",
        alias: "a",
        multiple: true,
        type: String,
      },
      {
        name: "remove",
        alias: "r",
        type: Boolean,
      },
      {
        name: "find",
        type: String,
      },
      {
        name: "content-too",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: ["Tags a file and shows existent tags."],
      examples: [
        "tag ethWallet.yml -a wallet,ethereum",
        ["tag ethWallet.yml -r ethereum", 'removes tag "ethereum"'],
        ["tag", "lists all tags in the current dataset"],
        ["tag -lg", "lists all tags in any dataset"],
        ["tag -s wallet", "lists all files tagged wallet"],
        ["tag -s email cloud", "lists all files tagged email and cloud"],
      ],
    };
  }

  async tag(options, nodes) {
    let result = [];
    if (!Object.keys(options).length) {
      options.list = true;
    }
    if (options.list) {
      if (options.global) {
        let datasetInfo = await this.internalFs.getDatasetsInfo();
        let result = {};
        for (let dataset of datasetInfo) {
          await this.internalFs.mountTree(dataset.index);
          let tags = this.internalFs.trees[dataset.index].listTags();
          if (tags.length) {
            result[dataset.name] = tags;
          }
        }
        return result;
      } else {
        return this.internalFs.tree.listTags();
      }
    } else if (options.show) {
      if (options.global) {
        let datasetInfo = await this.internalFs.getDatasetsInfo();
        result = [];
        for (let dataset of datasetInfo) {
          await this.internalFs.mountTree(dataset.index);
          let tags = this.internalFs.trees[dataset.index]
            .getNodesByTag(options.show)
            .map((e) => {
              e[0] = dataset.name + ":" + e[0];
              return e;
            });
          result = result.concat(tags);
        }
      } else {
        result = this.internalFs.tree.getNodesByTag(options.show);
      }
      if (!result.length) {
        throw new Error("Tagged files not found");
      }
      return result;
    } else if (nodes || options.path || options.find) {
      if (/:[/]*$/.test(options.path || "")) {
        throw new Error("Datasets are not taggable");
      }
      if (!nodes) {
        if (options.find) {
          options.getNodes = true;
          options.name = options.find;
          options.content = options.contentToo;
          nodes = (await this.prompt.commands.find.find(options)).filter((n) =>
            Node.isFile(n)
          );
        } else {
          nodes = await this.internalFs.fileList(options.path, null, true);
        }
      }
      let isSaveEnabled = {};
      for (let node of nodes) {
        let datasetIndex = Node.getRoot(node).datasetIndex;
        let tree = this.internalFs.trees[datasetIndex];
        if (typeof isSaveEnabled[datasetIndex.toString()] === "undefined") {
          isSaveEnabled[datasetIndex.toString()] = tree.isSaveEnabled();
          if (tree.isSaveEnabled()) {
            // it's called from another command, like Import
            tree.disableSave();
          }
        }
        if (options.add) {
          await tree.addTag(
            node,
            options.add.map((e) => Case.snake(_.trim(e)))
          );
          let s = options.add.length > 1 ? "s" : "";
          result = [`Tag${s} added`];
        } else if (options.remove) {
          await tree.removeTag(
            node,
            options.remove.map((e) => Case.snake(_.trim(e)))
          );
          let s = options.remove.length > 1 ? "s" : "";
          result = [`Tag${s} removed`];
        }
      }
      for (let datasetIndex in isSaveEnabled) {
        if (isSaveEnabled[datasetIndex]) {
          this.internalFs.trees[datasetIndex].enableSave();
          await this.internalFs.trees[datasetIndex].saveTags();
        }
      }
      return result;
    }
    throw new Error("Insufficient parameters");
  }

  formatResult(result) {
    const cols = utils.getCols();

    let max = 0;
    let mak = 0;
    for (let r of result) {
      max = Math.max(max, r[0].length);
      mak = Math.max(mak, r[1].length);
    }

    if (max + mak + 2 > cols) {
      return result.map((e) => e[0] + "\n" + chalk.cyan(e[1]));
    } else {
      return result.map(
        (e) => e[0] + " ".repeat(max - e[0].length) + "  " + chalk.cyan(e[1])
      );
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      
      // Check for git conflicts before adding/removing tags
      if (options.add || options.remove) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }
      
      let result = await this.tag(options);
      if (options.list) {
        if (options.global) {
          for (let name in result) {
            this.Logger.grey(name);
            this.Logger.cyan(
              this.prompt.commandPrompt.formatList(
                result[name],
                26,
                true,
                this.threeRedDots()
              )
            );
          }
        } else {
          this.Logger.cyan(
            this.prompt.commandPrompt.formatList(
              result,
              26,
              true,
              this.threeRedDots()
            )
          );
        }
      } else if (options.show) {
        for (let r of this.formatResult(result)) {
          this.Logger.reset(r);
        }
      } else {
        for (let r of result) {
          this.Logger.grey(r);
        }
      }
    } catch (e) {
      // console.log(e)
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Tag;
