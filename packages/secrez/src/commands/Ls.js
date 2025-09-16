class Ls extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.ls = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.ls = true;
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
        name: "all",
        alias: "a",
        type: Boolean,
      },
      {
        name: "datasets",
        completionType: "dataset",
        alias: "d",
        type: Boolean,
      },
      {
        name: "only",
        alias: "o",
        type: String,
      },
    ];
  }

  help() {
    return {
      description: ["Browses the directories."],
      examples: [
        "ls coin",
        "ls ../passwords",
        "ls ~",
        [
          "ls -l",
          "Shows details:",
          "size, creation date, last update date,",
          " number of versions and name",
        ],
        ["ls -al", "Includes hidden files"],
        ["ls -o d", "Lists only the directories"],
        ["ls -o f", "Lists only the files"],
        ["ls -d", "Lists the existent datasets"],
      ],
    };
  }

  formatTs(ts) {
    let months = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(",");
    let d = new Date(ts);
    let today = new Date();
    let currentYear = today.getFullYear();
    let year = d.getFullYear();
    if (year === currentYear) {
      year =
        this.prependWithSpace(d.getHours(), 2) +
        ":" +
        this.prependWithSpace(d.getMinutes(), 2);
    }
    return [
      months[d.getMonth()],
      this.prependWithSpace(d.getDate().toString(), 2),
      this.prependWithSpace(year.toString(), 5),
    ].join(" ");
  }

  prependWithSpace(str, max) {
    return " ".repeat(max - str.length) + str;
  }

  async ls(options = {}) {
    let datasetInfo = await this.internalFs.getDatasetsInfo();
    if (options.datasets) {
      return datasetInfo.map((e) => e.name);
    } else {
      if (!options.path) {
        options.path = ".";
      }
      let ds;
      if (/^[a-zA-Z]{1}\w{1,15}:/.test(options.path)) {
        ds = options.path.split(":")[0];
      }
      options.ignoreDatasets = true;
      if (datasetInfo.map((e) => e.name).includes(options.path)) {
        options.path += ":";
      }
      if (options.list) {
        let list = await this.internalFs.fileList(options, false, true);
        let maxLength = 0;
        let maxVersionNumber = 0;
        let finalList = [];
        let tree;
        for (let i = 0; i < list.length; i++) {
          if (!tree) {
            if (ds) {
              for (let d of datasetInfo) {
                if (d.name === ds) {
                  tree = this.internalFs.trees[d.index];
                }
              }
            } else {
              tree = this.internalFs.tree;
            }
          }
          let ts = list[i].lastTs;
          let details = await tree.getEntryDetails(list[i], ts);
          let ts0 = (ts = parseInt(ts.split(".")[0]) * 1000);
          let versions = Object.keys(list[i].versions);
          for (let v of versions) {
            let timestamp = parseInt(v.split(".")[0]) * 1000;
            if (timestamp < ts0) {
              ts0 = timestamp;
            }
          }
          details.ts0 = ts0;
          details.ts = ts;
          details.size = ((details.content || "").length || 0).toString();
          maxLength = Math.max(maxLength, details.size.length);
          details.versions = versions.length.toString();
          maxVersionNumber = Math.max(
            maxVersionNumber,
            details.versions.length
          );
          finalList.push(details);
        }
        finalList = finalList.map((e) => {
          return [
            this.prependWithSpace(e.size, maxLength),
            this.formatTs(e.ts0),
            this.formatTs(e.ts),
            this.prependWithSpace(e.versions, maxVersionNumber),
            e.name + (e.type === this.secrez.config.types.DIR ? "/" : ""),
          ].join("  ");
        });
        return finalList;
      } else {
        return await this.internalFs.fileList(options, true);
      }
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      // Track the last path used if a path was specified
      if (options.path) {
        this.prompt.setLastPath(options.path);
      }
      let list = await this.ls(options);
      list = list.filter((e) => !/^\./.test(e) || options.all).sort();
      if (list.length) {
        this.Logger.reset(
          options.list
            ? list.join("\n")
            : this.prompt.commandPrompt.formatList(
                list,
                26,
                true,
                this.threeRedDots()
              )
        );
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Ls;
