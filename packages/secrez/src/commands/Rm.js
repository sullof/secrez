const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const { Node } = require("@secrez/fs");

class Rm extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.rm = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.rm = true;
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
        name: "versions",
        alias: "v",
        multiple: true,
        type: String,
      },
    ];
  }

  help() {
    return {
      description: [
        "Removes one or more files and folders.",
        'Technically files are moved to the trash dataset (access it with "use trash").',
        "If you remove a file from the trash dataset, the data will be deleted from disk;",
        "this action is not undoable.",
      ],
      examples: [
        "rm secret1",
        [
          "rm secret2 -v au7t RF6z",
          'deleted the versions "au7t" and "RF6z" of the file',
        ],
      ],
    };
  }

  async rm(options = {}) {
    options.asIs = true;
    options.newPath = "trash:/";
    options.removing = true;

    let nodes = await this.internalFs.fileList(options, null, true);
    let deleted = nodes.map((n) => n.getPath());
    if (deleted.length) {
      if (options.versions) {
        if (deleted.length > 1) {
          throw new Error("You can delete versions of a single file at time");
        }
        /* istanbul ignore if */
        if (!process.env.NODE_ENV === "test") {
          this.Logger.reset("The deletion of a version is not reversible.");
          let message = "Are you sure you want to proceed?";
          let yes = await this.useConfirm({
            message,
            default: false,
          });
          if (!yes) {
            return "Operation canceled";
          }
        }
        let { datasetIndex } = Node.getRoot(nodes[0]);
        let res = [];
        for (let ts in nodes[0].versions) {
          let v = Node.hashVersion(ts);
          if (options.versions.indexOf(v) !== -1) {
            let file = nodes[0].versions[ts].file;
            await fs.remove(
              path.join(
                this.secrez.config.dataPath +
                  (datasetIndex ? `.${datasetIndex}` : ""),
                file
              )
            );
            res.push(
              this.formatResult({
                name: path.basename(deleted[0]),
                version: v,
              })
            );
            delete nodes[0].versions[ts];
            this.internalFs.trees[datasetIndex].save();
          }
        }
        return res;
      }
      await this.prompt.commands.mv.mv(options, nodes);
    }
    return deleted;
  }

  formatResult(item) {
    return [chalk.yellow(item.version), item.name].join(" ");
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    if (!options.path) {
      this.Logger.red("File path not specified.");
    } else {
      try {
        this.validate(options);
        
        // Check for git conflicts before removing files
        if (!options.help) {
          const shouldProceed = await this.checkGitConflictsBeforeOperation();
          if (!shouldProceed) {
            await this.prompt.run();
            return;
          }
        }
        
        let deleted = await this.rm(options);
        if (deleted.length === 0) {
          this.Logger.grey("No files have been deleted.");
        } else {
          this.Logger.grey("Deleted entries:");
          if (typeof deleted === "string") {
            this.Logger.reset(deleted);
          } else {
            for (let d of deleted) {
              this.Logger.reset(d);
            }
          }
        }
      } catch (e) {
        this.Logger.red(e.message);
      }
    }
    await this.prompt.run();
  }
}

module.exports = Rm;
