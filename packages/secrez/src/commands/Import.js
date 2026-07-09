const fs = require("fs-extra");
const path = require("path");
const utils = require("@secrez/utils");
const Case = require("case");
const _ = require("lodash");
const chalk = require("chalk");
const { config, Entry } = require("@secrez/core");
const { Node, FileCipher } = require("@secrez/fs");
const { fromCsvToJson, yamlStringify, isYaml } = require("@secrez/utils");

class Import extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.import = {
      _func: this.selfCompletion(this, {
        external: true,
      }),
      _self: this,
    };
    this.cliConfig.completion.help.import = true;
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
        name: "move",
        alias: "m",
        type: Boolean,
      },
      {
        name: "binary-too",
        alias: "b",
        type: Boolean,
      },
      {
        name: "simulate",
        alias: "s",
        type: Boolean,
      },
      {
        name: "expand",
        alias: "e",
        type: String,
        hint: "It must be on the current dataset",
      },
      {
        name: "recursive",
        alias: "r",
        type: Boolean,
      },
      {
        name: "tags",
        alias: "t",
        type: Boolean,
      },
      {
        name: "use-tags-for-paths",
        alias: "u",
        type: Boolean,
      },
      {
        name: "path-from",
        alias: "P",
        type: String,
        multiple: true,
      },
      {
        name: "password",
        type: String,
      },
      {
        name: "iterations",
        alias: "i",
        type: Number,
      },
      {
        name: "public-key",
        type: String,
      },
    ];
  }

  help() {
    return {
      description: [
        "Import files from the OS into the current folder",
        "By default binary files are not imported since they can be very large.",
        "To include them, use the -b option.",
        "During a move, only the imported files are moved. To avoid problems",
        "you can simulate the process using -s and see which ones will be imported.",
        'Import can import data from password managers and other software. If in CSV format, the first line must list the field names and one field must be "path". Similarly, if in JSON format, a "path" key is mandatory in any item. Path should be relative. If not, it will be converted.',
        "Also notice that to import from a CSV file you must specify where to expand the data, if not",
        "the file will be imported as a single file.",
      ],
      examples: [
        [
          "import seed.json",
          "copies seed.json from the disk into the current directory",
        ],
        [
          "import seed.json.secrez --password s8eeuhwy36534 -i 500000",
          "imports seed.json and decrypts it using the specified password and iterations",
        ],
        [
          "import old-backup.secrez --password s8eeuhwy36534",
          "imports a file encrypted with the legacy v1 format (password only; no iterations)",
        ],
        [
          "import seed.json.secrez",
          "imports seed.json trying to decrypt it using the key shared with the contact who encrypted the data",
        ],
        [
          "import seed.json.secrez--public-key Tush76/u+..... ",
          "imports seed.json trying to decrypt it using a shared key generated using the specified public key",
        ],
        ["import -m ethKeys", "copies ethKeys and remove it from the disk"],
        [
          "import -p ~/passwords",
          "imports all the text files in the folder passwords",
        ],
        [
          "import -b -p ~/passwords",
          "imports all the files, included binaries",
        ],
        [
          "import -r ~/data -t",
          "imports text files in the folder, recursively",
        ],
        [
          "import ~/data -s",
          "simulates the process listing all involved files",
        ],
        [
          "import backup.csv -e /imported",
          'imports a backup creating files in the "/imported"',
        ],
        ["import backup.json -e .", "imports a backup in the current folder"],
        [
          "import backup.csv -e / -m",
          "imports a backup in the root, deleting the CSV file from the disk",
        ],
        [
          "import backup.csv -te /",
          "imports a backup saving the tags field as actual tags",
        ],
        [
          "import backup.csv -ute /fromPasspack",
          "uses the tags to prefix the path and keeps the tags;",
          'ex: if "google" is tagged "web,email" the path becomes',
          '"./web/email/google" or "./email/web/google"',
          "based on the tag weight",
        ],
        [
          "import backup.csv -ue /fromPasspack",
          "uses the tags to prefix the path without saving the tags",
        ],
        [
          "import lastpass.csv -e /imports -P grouping name",
          'concatenates the fields "grouping" and "name" to obtain the path',
        ],
        [
          'import backup.csv -e /imports -P "entry name"',
          'uses the field "entry name" for the path,',
          "i.e., puts everything in the directory /imports,",
          "without creating any subdirectory",
        ],
      ],
    };
  }

  async import(options = {}) {
    this.internalFs.tree.disableSave();
    this.skipped = [];
    let result = await this._import(options);
    this.internalFs.tree.enableSave();
    if (result.length && !options.simulate) {
      await this.internalFs.tree.save();
    }
    return [result.sort(), this.skipped];
  }

  async _import(options = {}, container = "") {
    let ifs = this.internalFs;
    let efs = this.externalFs;
    let fileCipher = new FileCipher(this.secrez);
    let p = efs.getNormalizedPath(options.path);
    if (await fs.pathExists(p)) {
      let isDir = await efs.isDir(p);
      let list = isDir
        ? (await efs.getDir(p))[1].map((f) => path.join(p, f))
        : [p];
      let content = [];
      let result = [];
      let moved = [];
      for (let fn of list) {
        if (await efs.isDir(fn)) {
          if (options.recursive) {
            result = await this._import(
              Object.assign(options, { path: fn }),
              (container ? `${container}/` : "") + path.basename(fn)
            );
          } else {
            continue;
          }
        }
        if (/\/$/.test(fn)) {
          continue;
        }
        let isEncryptedBinary = /\.secrezb(|\.\w+)$/.test(fn);
        let isBinary = await utils.isBinary(fn);
        if ((isEncryptedBinary || isBinary) && !options.binaryToo) {
          this.skipped.push([
            path.basename(fn),
            'binary file; use "-b" to include binaries',
          ]);
          continue;
        }
        content.push([
          fn,
          isBinary || isEncryptedBinary,
          await fs.readFile(fn, isBinary ? undefined : "utf8"),
        ]);
      }
      let contactsPublicKeys;
      for (let c of content) {
        let basename = Entry.sanitizeName(path.basename(c[0]), "-");
        let isEncrypted = /\.secrez(|b)(|\.\w+)$/.test(basename);
        let isEncryptedBinary;
        if (isEncrypted) {
          isEncryptedBinary = /\.secrezb(|\.\w+)$/.test(basename);
          basename = basename.replace(/\.secrez(|b)(|\.\w+)$/, "");
        }
        if (isEncrypted && !contactsPublicKeys && !options.publicKey) {
          contactsPublicKeys = await this.getContactsPublicKeys();
        }
        let name = await this.internalFs.tree.getVersionedBasename(basename);
        if (container) {
          name = container + "/" + name;
        }
        result.push(this.internalFs.tree.getNormalizedPath(name));
        if (!options.simulate) {
          if (options.move) {
            moved.push(c[0]);
          }
          if (isEncrypted) {
            try {
              options.returnUint8Array = isEncryptedBinary;
              if (!options.contactPublicKey) {
                options.contactsPublicKeys = contactsPublicKeys;
              }
              const version = String(c[2]).split(",")[0];
              if (version === "2" && options.password && !options.iterations) {
                let iterationsInput = await this.useInput({
                  message:
                    "Type the number of iterations used when the file was exported",
                  validate: (val) => {
                    const n = parseInt(val, 10);
                    return (
                      (n > 0 && String(n) === String(val).trim()) ||
                      "Must be a positive integer"
                    );
                  },
                });
                if (!iterationsInput) {
                  throw new Error("Operation canceled");
                }
                options.iterations = parseInt(iterationsInput, 10);
              }
              c[2] = fileCipher.decryptFile(c[2], options);
            } catch (e) {
              this.skipped.push([path.basename(c[0]), e.message]);
              continue;
            }
          }
          let node = await ifs.make({
            path: name,
            type: c[1] ? config.types.BINARY : config.types.TEXT,
            content: c[2],
          });
          result.pop();
          result.push(node.getPath());
        }
      }
      if (!options.simulate) {
        if (options.move) {
          for (let fn of moved) {
            await fs.unlink(fn);
          }
        }
      }
      return result;
    } else {
      return [];
    }
  }

  async getContactsPublicKeys() {
    let contacts = await this.prompt.commands.contacts.contacts({
      list: true,
      asIs: true,
    });
    let publicKeys = [];
    for (let contact of contacts) {
      publicKeys.push(contact[1].publicKey);
    }
    return publicKeys;
  }

  async expand(options) {
    let ifs = this.internalFs;
    let efs = this.externalFs;
    let fn = efs.getNormalizedPath(options.path);
    if (!(await fs.pathExists(fn))) {
      return this.Logger.red("The file does not exist");
    }
    let str = await fs.readFile(fn, "utf-8");
    let ext = path.extname(fn);
    let data;
    if (ext === ".json") {
      data = JSON.parse(str);
    } else if (ext === ".csv") {
      try {
        data = fromCsvToJson(str);
      } catch (e) {
        return this.Logger.red(e.message);
      }
    }
    if (data.length === 0) {
      return this.Logger.red("The data is empty");
    }
    if (!data[0].path) {
      if (options.pathFrom) {
        let pathFrom = options.pathFrom.map((e) => Case.snake(_.trim(e)));
        for (let item of data) {
          let p = "";
          for (let f of pathFrom) {
            p +=
              (p ? "/" : "") + (typeof item[f] !== "undefined" ? item[f] : "");
            delete item[f];
          }
          if (!p) {
            throw new Error("Path cannot be built from the specified fields");
          }
          item.path = p.replace(/\/+/g, "/").replace(/:+/g, "_");
        }
      } else {
        return this.Logger.red("The data misses a path field");
      }
    }
    if (options.useTagsForPaths) {
      let weightedTags = {};
      for (let item of data) {
        if (item.tags) {
          let tags = item.tags.split(" ");
          for (let t of tags) {
            if (!weightedTags[t]) {
              weightedTags[t] = 0;
            }
            weightedTags[t]++;
          }
        }
      }
      for (let item of data) {
        if (item.tags) {
          let tags = item.tags.split(" ");
          item.path =
            tags
              .sort((a, b) => {
                let A = weightedTags[a];
                let B = weightedTags[b];
                return A > B ? -1 : A < B ? 1 : 0;
              })
              .join("/") +
            "/" +
            item.path;
          if (!options.tags) {
            delete item.tags;
          }
        }
      }
    }
    let extra = "";
    if (options.simulate) {
      extra = " (simulation)";
    } else if (options.move) {
      extra = " (moved)";
    }
    this.Logger.grey(`Imported files${extra}:`);

    let parentFolderPath = this.internalFs.tree.getNormalizedPath(
      options.expand
    );
    let parentFolder;
    try {
      parentFolder =
        this.internalFs.tree.root.getChildFromPath(parentFolderPath);
    } catch (e) {
      await this.prompt.commands.mkdir.mkdir({
        path: parentFolderPath,
        type: config.types.DIR,
      });
      parentFolder =
        this.internalFs.tree.root.getChildFromPath(parentFolderPath);
    }
    if (!Node.isDir(parentFolder)) {
      return this.Logger.red("The destination folder is not a folder.");
    }
    this.internalFs.tree.disableSave();
    for (let item of data) {
      let p = item.path;
      if (!p) {
        continue;
      }
      p = path.resolve(parentFolderPath, p.replace(/^\//, ""));
      let dirname = path.dirname(p);
      let dir;
      try {
        dir = this.internalFs.tree.root.getChildFromPath(dirname);
      } catch (e) {
        await this.prompt.commands.mkdir.mkdir({
          path: dirname,
          type: config.types.DIR,
        });
        dir = this.internalFs.tree.root.getChildFromPath(dirname);
      }
      let name = path.basename(p);
      if (!isYaml(name)) {
        name += ".yaml";
      }
      name = await this.internalFs.tree.getVersionedBasename(
        path.join(dirname, name),
        dir
      );
      this.Logger.reset(path.join(dirname, name));
      if (!options.simulate) {
        delete item.path;
        let tags;
        if (options.tags) {
          tags = item.tags;
          delete item.tags;
        }
        let node = await ifs.make({
          path: path.join(dirname, name),
          type: config.types.TEXT,
          content: yamlStringify(item),
        });
        if (tags) {
          tags = tags.split(" ").filter((e) => e);
          await this.prompt.commands.tag.tag({ add: tags }, [node]);
        }
      }
    }
    if (!options.simulate) {
      this.internalFs.tree.enableSave();
      await this.internalFs.tree.save();
      if (options.tags) {
        await this.internalFs.tree.saveTags();
      }
      if (options.move) {
        await fs.unlink(fn);
      }
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);

      // Check for git conflicts before importing files (skip if help or simulate)
      if (!options.help && !options.simulate) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }

      if (options.expand) {
        await this.expand(options);
      } else {
        if (/\.csv$/i.test(options.path)) {
          let yes = await this.useConfirm({
            message:
              "You are importing a CSV file as a single file.\nMaybe, you wanted to import from a backup and forgot to specify the expand (-e) option.\nAre you sure you want to proceed?",
            default: false,
          });
          if (!yes) {
            await this.prompt.run();
            return;
          }
        }
        let [files, skipped] = await this.import(options);
        if (files.length) {
          let extra = "";
          if (options.simulate) {
            extra = " (simulation)";
          } else if (options.move) {
            extra = " (moved)";
          }
          this.Logger.grey(`Imported files${extra}:`);
          for (let f of files) {
            this.Logger.reset(f);
          }
          if (skipped.length) {
            this.Logger.grey("Skipped files:");
            for (let f of skipped) {
              this.Logger.reset(f[0] + chalk.yellow(" (" + f[1] + ")"));
            }
          }
        } else if (skipped.length) {
          this.Logger.grey("Skipped files:");
          for (let f of skipped) {
            this.Logger.reset(f[0] + chalk.yellow(" (" + f[1] + ")"));
          }
        } else {
          this.Logger.red("No file has been imported.");
        }
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Import;
