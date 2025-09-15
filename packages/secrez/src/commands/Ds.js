class Ds extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.ds = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.ds = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "list",
        alias: "l",
        type: Boolean,
      },
      {
        name: "create",
        alias: "c",
        type: String,
      },
      {
        name: "rename",
        alias: "r",
        multiple: true,
        type: String,
      },
      {
        name: "delete",
        alias: "d",
        type: String,
      },
    ];
  }

  help() {
    return {
      description: ["Manages datasets"],
      examples: [
        ["ds -l", "lists all datasets"],
        [
          "ds -c archive",
          'create the dataset named "archive";',
          "if the dataset does not exists it creates it",
        ],
        [
          "ds -r archive unused",
          'if the "archive" dataset exists, renames it "unused"',
        ],
        ["ds -d cryptos", 'deletes the dataset "cryptos" if it exists'],
      ],
    };
  }

  async exists(set) {
    let datasetsInfo = await this.internalFs.getDatasetsInfo();
    for (let dataset of datasetsInfo) {
      if (dataset.name.toLowerCase() === set.toLowerCase()) {
        return dataset.index;
      }
    }
    return -1;
  }

  async ds(options) {
    let datasetsInfo = await this.internalFs.getDatasetsInfo();
    if (options.rename) {
      let name = options.rename[0];
      let newName = options.rename[1];
      this.internalFs.tree.validateDatasetName(newName);
      let index = await this.exists(name);
      if (index >= 0) {
        if (["main", "trash"].includes(name)) {
          throw new Error("main and trash cannot be renamed");
        }
        if ((await this.exists(newName)) >= 0) {
          throw new Error(`A dataset named ${newName} already exists`);
        }
        await this.internalFs.trees[index].nameDataset(newName);
        this.internalFs.updateTreeCache(index, newName);
        return `The dataset ${name} has been renamed ${newName}`;
      }
    } else if (options.create) {
      let newName = options.create;
      if ((await this.exists(newName)) >= 0) {
        throw new Error(`A dataset named ${newName} already exists`);
      }
      this.internalFs.tree.validateDatasetName(newName);
      let index = datasetsInfo[datasetsInfo.length - 1].index + 1;
      await this.internalFs.mountTree(index, true);
      await this.internalFs.tree.nameDataset(newName);
      return `The dataset ${newName} has been created`;
    } else if (options.delete) {
      let name = options.delete;
      let index = await this.exists(name);
      if (index < 0) {
        throw new Error(`A dataset named ${name} does not exist`);
      }
      if (index === this.internalFs.treeIndex) {
        return "You can not delete the active dataset";
      }
      let list = await this.prompt.commands.ls.ls({
        path: `${name}:/`,
      });
      if (list.length > 0 && process.env.NODE_ENV !== "test") {
        let yes = await this.useConfirm({
          message: `The dataset ${name} contains files. Are you sure you want to delete it?`,
          default: false,
        });
        if (!yes) {
          return "Operation canceled";
        }
      }
      for (let file of list) {
        await this.prompt.commands.mv.mv({
          path: `${name}:/${file}`,
          newPath: "trash:/",
        });
      }
      if (this.internalFs.deleteDataset(index)) {
        return `The dataset ${name} has been canceled. Its content has been moved to the "trash" dataset`;
      } else {
        throw new Error("Unknown error");
      }
    } else if (options.list) {
      return (await this.internalFs.getDatasetsInfo()).map((e) => e.name);
    }
    throw new Error("Wrong parameters");
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      if (!Object.keys(options).length) {
        options.list = true;
      }
      this.validate(options);
      
      // Check for git conflicts before creating/renaming/deleting datasets
      if (options.create || options.rename || options.delete) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }
      
      let result = await this.ds(options);
      if (result) {
        if (options.list) {
          this.Logger.reset(
            this.prompt.commandPrompt.formatList(
              result,
              26,
              true,
              this.threeRedDots()
            )
          );
        } else {
          this.Logger.reset(result);
        }
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Ds;
