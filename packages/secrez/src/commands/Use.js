class Use extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.use = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.use = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "dataset",
        completionType: "dataset",
        alias: "d",
        defaultOption: true,
        type: String,
      },
      {
        name: "create",
        alias: "c",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: ["Uses a specific dataset."],
      examples: [
        ["use archive", 'use "archive" dataset if it exists'],
        [
          "use -c archive",
          'use the dataset named "archive";',
          "if the dataset does not exists it creates it",
        ],
      ],
    };
  }

  async use(options) {
    let datasetsInfo = await this.internalFs.getDatasetsInfo();
    if (options.dataset) {
      let newSet;
      for (let dataset of datasetsInfo) {
        if (dataset.name.toLowerCase() === options.dataset.toLowerCase()) {
          newSet = dataset;
          break;
        }
      }
      if (!newSet && !options.create) {
        throw new Error('The dataset does not exist; add "-c" to create it');
      }
      if (newSet && newSet.index === this.internalFs.treeIndex) {
        return `You are already using ${options.dataset}`;
      } else if (newSet) {
        await this.internalFs.mountTree(newSet.index, true);
      } else {
        // create
        this.internalFs.tree.validateDatasetName(options.dataset);
        let index = datasetsInfo[datasetsInfo.length - 1].index + 1;
        await this.internalFs.mountTree(index, true);
        await this.internalFs.tree.nameDataset(options.dataset);
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
      
      // Check for git conflicts before creating new datasets
      if (options.create) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }
      
      let result = await this.use(options);
      if (result) {
        this.Logger.reset(result);
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Use;
