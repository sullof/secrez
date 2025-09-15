const _ = require("lodash");
const { Node } = require("@secrez/fs");

class Mv extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.mv = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.mv = true;
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
        multiple: true,
        type: String,
      },
      {
        name: "find",
        type: String,
      },
      {
        name: "destination",
        alias: "d",
        type: String,
      },
      {
        name: "content-too",
        type: Boolean,
      },
      {
        name: "span",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: [
        "Moves and renames files or folders.",
        "If a destination is not specified it tries to move to the current folder.",
      ],
      examples: [
        "mv somefile someother",
        "mv -p ../dir1/file -d ../dir1/file-renamed",
        [
          "mv pass/email* emails",
          "moves all the files starting from email contained in pass",
        ],
        [
          "mv pass/email* archive:/old/email",
          "moves all the files starting from email contained in pass",
          'to the folder "/old/email" in the "archive" dataset;',
          "The autocomplete works only in the current dataset (for now)",
        ],
        [
          "mv archive:/old/email/* /old-email",
          "moves all the files starting from email contained in /old/email",
          'in the "archive" dataset to the folder "/old-email" in the current dataset',
        ],
        [
          "mv --find email -d /emails",
          "moves all the files found searching email to /emails;",
        ],
        [
          "mv --find email -d /emails --content-too",
          "moves all the files found searching email in paths and contents",
        ],
        [
          "mv --find email -d archive:/emails --span ",
          "moves all the files flattening the results",
        ],
      ],
    };
  }

  async mv(options, nodes) {
    let dataFrom = await this.internalFs.getTreeIndexAndPath(options.path);
    await this.internalFs.mountTree(dataFrom.index);
    let dataTo = await this.internalFs.getTreeIndexAndPath(options.newPath);
    if (dataFrom.index !== dataTo.index) {
      await this.internalFs.mountTree(dataTo.index);
    } else if (dataFrom.index === 1 && options.removing) {
      /* istanbul ignore if  */
      let yes = await this.useConfirm({
        message:
          "Are you sure you want to definitely remove those file from Secrez?",
        default: false,
      });
      if (!yes) {
        throw new Error("Operation canceled");
      }
    }
    if (nodes) {
      this.internalFs.trees[dataFrom.index].disableSave();
      this.internalFs.trees[dataTo.index].disableSave();
      for (let node of nodes) {
        let opt = _.clone(options);
        await this.internalFs.change(
          Object.assign(opt, { path: `${dataFrom.name}:${node.getPath()}` })
        );
      }
      this.internalFs.trees[dataFrom.index].enableSave();
      await this.internalFs.trees[dataFrom.index].save();
      if (dataFrom.index !== dataTo.index) {
        this.internalFs.trees[dataTo.index].enableSave();
        await this.internalFs.trees[dataTo.index].save();
      }
    } else {
      await this.internalFs.change(options);
    }
  }

  async isNotDir(options = {}) {
    let dir;
    try {
      let data = await this.internalFs.getTreeIndexAndPath(
        options.newPath || ""
      );
      let to = data.name;
      let index = this.internalFs.tree.datasetIndex;
      if (to) {
        let datasetInfo = await this.internalFs.getDatasetInfo(to);
        if (!datasetInfo) {
          throw new Error("Destination dataset does not exist");
        }
        index = datasetInfo.index;
        await this.internalFs.mountTree(index);
      }
      let p = this.internalFs.normalizePath(data.path, index);
      dir = this.internalFs.trees[index].root.getChildFromPath(p);
    } catch (e) {}
    return !(dir && Node.isDir(dir));
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);

      // Check for git conflicts before moving/renaming files
      if (!options.help) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }

      if (options.find) {
        options.newPath = options.destination;
        options.path = options.find;
      } else {
        if (options.destination) {
          options.newPath = options.destination;
        } else {
          options.newPath = options.path[1];
        }
        options.path = options.path[0];
      }
      if (!options.path && !options.find) {
        throw new Error("An origin path is required.");
      } else {
        if (!options.newPath) {
          options.message =
            "Destination not set.\nWould you like to move to the current active directory in the target dataset?";
          options.default = false;
          let yes = await this.useConfirm(options);
          if (yes) {
            options.newPath = ".";
          } else {
            throw new Error("Operation canceled");
          }
        }
        let dataFrom = await this.internalFs.getTreeIndexAndPath(options.path);
        let mustBeFolder = options.find || /\?|\*/.test(options.path);
        let nodes;
        if (options.find) {
          options.getNodes = true;
          options.name = options.find;
          options.content = options.contentToo;
          nodes = await this.prompt.commands.find.find(options);
          if (!options.span) {
            for (let i = 0; i < nodes.length; i++) {
              if (i > 0) {
                if (Node.isAncestor(nodes[i - 1], nodes[i])) {
                  nodes.splice(i, 1);
                  i--;
                }
              }
            }
          }
        } else {
          nodes = await this.internalFs.fileList(
            {
              path: options.path,
              asIs: true,
            },
            null,
            true
          );
        }
        if (nodes.length) {
          if (mustBeFolder) {
            if (await this.isNotDir(options)) {
              throw new Error(
                "When using search results or wildcards, the target has to be a folder"
              );
            }
          }
          let paths = nodes.map((e) => [e.getPath(), e.id]);
          await this.mv(
            Object.assign(options, { newPath: options.newPath }),
            nodes
          );
          if (options.find) {
            this.Logger.reset(
              `The results of searching for ${options.find} has been moved to ${options.newPath}`
            );
          } else {
            this.Logger.reset("The following have been moved:");
            let data = await this.internalFs.getTreeIndexAndPath(
              options.newPath || ""
            );
            for (let p of paths) {
              this.Logger.reset(
                `${dataFrom.name}:${p[0]}  >  ${data.name}:${data.tree.root
                  .findChildById(p[1])
                  .getPath()}`
              );
            }
          }
        } else {
          this.Logger.red("Path does not exist");
        }
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Mv;
