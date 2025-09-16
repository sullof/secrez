const _ = require("lodash");
const { chalk } = require("../utils/Logger");
const path = require("path");
const { config } = require("@secrez/core");
const Crypto = require("@secrez/crypto");
const { Node } = require("@secrez/fs");
const { isYaml, yamlParse } = require("@secrez/utils");

class Cat extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.cat = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.cat = true;
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
        name: "metadata",
        alias: "m",
        type: Boolean,
      },
      {
        name: "version",
        alias: "v",
        multiple: true,
        type: String,
      },
      {
        name: "all",
        alias: "a",
        type: Boolean,
      },
      {
        name: "field",
        alias: "f",
        type: String,
        hint: "Shows only the specified field if a Yaml file",
      },
      {
        name: "unformatted",
        alias: "u",
        type: Boolean,
        hint: "If a Yaml file, it does not format the output",
      },
    ];
  }

  help() {
    return {
      description: ["Shows the content of a file."],
      examples: [
        "cat ../passwords/Facebook",
        ["cat wallet -m", "shows metadata: version and creation date"],
        [
          "cat etherWallet -v 2UYw",
          "shows the version 2UYw of the secret, if exists",
        ],
        ["cat etherWallet -a", "lists all the versions"],
        ["cat etherWallet -v 17TR hUUv", "shows two versions (-m is forced)"],
        [
          "cat wallet.yml -f private_key",
          "shows only the field private_key of a yaml file",
        ],
        ["cat some.yml -u", "shows a Yaml file as is"],
      ],
    };
  }

  formatTs(ts, name) {
    let tsHash = Node.hashVersion(ts);
    ts = Crypto.fromTsToDate(ts);
    let date = ts[0].split("Z")[0].split("T");
    let ret = `-- ${chalk.bold(tsHash)} -- ${date[0]} ${date[1].substring(
      0,
      12
    )}${ts[1]}`;
    if (name) {
      ret += " (" + name + ")";
    }

    return ret;
  }

  async cat(options, justContent) {
    if (typeof options === "string") {
      options = {
        path: options,
      };
    }
    let data = await this.internalFs.getTreeIndexAndPath(options.path);
    options.path = data.path;
    let tree = data.tree;
    let p = tree.getNormalizedPath(options.path);
    let node = tree.root.getChildFromPath(p);
    if (node && Node.isFile(node)) {
      let result = [];
      if (!isYaml(p)) {
        delete options.field;
      }

      const pushDetails = async (node, ts, field) => {
        let details = await tree.getEntryDetails(node, ts);
        if (!justContent && !options.unformatted && isYaml(p)) {
          let fields;
          try {
            fields = yamlParse(details.content || "{}");
          } catch (e) {
            // wrong format
          }

          const format = (field) => {
            let val = fields[field];
            if (/\n/.test(val)) {
              val = "\n" + val;
            }
            return [chalk.grey(field + ":"), val].join(" ");
          };
          if (typeof fields === "object") {
            if (field) {
              if (fields[field]) {
                details.content = format(field);
              } else {
                details.content = chalk.yellow("-- empty field");
              }
            } else {
              let content = [];
              for (let f in fields) {
                content.push(format(f));
              }
              details.content = content.join("\n");
            }
          }
        }
        result.push(details);
      };

      if (options.all || options.version) {
        let versions = node.getVersions();
        if (options.version && options.version.length > 1) {
          options.metadata = true;
        }
        let found = [];
        for (let ts of versions) {
          let v = Node.hashVersion(ts);
          if (options.version) {
            if (!options.version.includes(v)) {
              continue;
            }
          }
          await pushDetails(node, ts, options.field);
          found.push(v);
        }
        if (options.version && options.version.length > found.length) {
          options.notFound = [];
          for (let v of options.version) {
            if (!found.includes(v)) {
              options.notFound.push(v);
            }
          }
        }
      } else {
        await pushDetails(node, options.ts, options.field);
      }
      return result;
    } else {
      throw new Error("Cat requires a valid file");
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options, {
        path: true,
      });
      // Track the last path used
      this.prompt.setLastPath(options.path);
      let fn = path.basename(options.path);
      let data = await this.cat(options);
      let extra = options.all || options.metadata || options.versions;
      if (data) {
        for (let d of data) {
          let { content, ts, type, name } = d;
          if (extra) {
            this.Logger.yellow(
              `${this.formatTs(ts, fn === name ? undefined : name)}`
            );
          }
          if (type === config.types.TEXT) {
            if (_.trim(content)) {
              this.Logger.reset(_.trim(content));
            } else {
              this.Logger.yellow("-- this version is empty");
            }
          } else {
            this.Logger.yellow("-- this is a binary file");
          }
        }
        if (options.notFound && options.notFound.length) {
          this.Logger.yellow(
            "Versions not found: " + options.notFound.join(" ")
          );
        }
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Cat;
