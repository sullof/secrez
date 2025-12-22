const chalk = require("chalk");
const { Node } = require("@secrez/fs");
const { config } = require("@secrez/core");

class Find extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.find = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.find = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "keywords",
        alias: "k",
        defaultOption: true,
        type: String,
      },
      {
        name: "content",
        alias: "c",
        type: Boolean,
        hint: "Search also in contents",
      },
      {
        name: "all",
        alias: "a",
        type: Boolean,
        hint: "Search all the versions",
      },
      {
        name: "sensitive",
        alias: "s",
        type: Boolean,
        hint: "Make the search case-sensitive",
      },
      {
        name: "root",
        alias: "r",
        type: Boolean,
        hint: "Search starting from the root",
      },
      {
        name: "global",
        alias: "g",
        type: Boolean,
        hint: "Search in all the datasets",
      },
      {
        name: "trash-too",
        alias: "t",
        type: Boolean,
        hint: "If global, search also in trash",
      },
      {
        name: "recent",
        alias: "R",
        type: Boolean,
        hint: "Search for recent changes",
      },
      {
        name: "limit",
        alias: "l",
        type: Number,
        hint: "Limit the number of results (default: 10 when recent is enabled)",
      },
    ];
  }

  help() {
    return {
      description: [
        "Find a secret.",
        "By default the search is case-unsensitive.",
      ],
      examples: [
        [
          "find Ethereum",
          "Search for entries with ethereum or Ethereum in the name",
        ],
        [
          "find -c 0xAB",
          'Search for files with the string "0xAB" in their content',
        ],
        [
          "find -sn Wallet",
          'Search for names containings "Wallet" from the current dir',
        ],
        [
          "find Wallet -ag",
          "Search scanning all the versions in all the datasets",
        ],
        ["find archive:allet", "Search allet in the archive dataset"],
        ["find -R", "Show the 10 most recent changes"],
        ["find -R -l 20", "Show the 20 most recent changes"],
        [
          "find -R keyword",
          "Show the 10 most recent entries matching 'keyword'",
        ],
      ],
    };
  }

  async find(options) {
    // Handle recent mode
    if (options.recent) {
      // Set default limit if not specified
      if (!options.limit) {
        options.limit = 10;
      }
      // Keywords are optional in recent mode
      if (!options.name && options.keywords) {
        options.name = options.keywords;
      }

      if (options.global) {
        let datasetInfo = await this.internalFs.getDatasetsInfo();
        let allResults = [];
        for (let dataset of datasetInfo) {
          if (options.global && !options.trashToo && dataset.index === 1) {
            continue;
          }
          await this.internalFs.mountTree(dataset.index);
          options.tree = this.internalFs.trees[dataset.index];
          options.dataset = dataset.name;
          // Collect raw results (with ts property) for sorting across datasets
          let rawResults = await this._findRecentRaw(options);
          allResults = allResults.concat(rawResults);
        }
        // Sort all results together by timestamp and limit
        allResults.sort((a, b) => {
          return Node.sortEntry(a.ts, b.ts);
        });
        if (allResults.length > options.limit) {
          allResults = allResults.slice(0, options.limit);
        }
        // Format results
        return allResults.map((e) => {
          let result = [
            Node.hashVersion(e.ts),
            e.path + (e.isDir ? "/" : ""),
            e.name,
            undefined,
          ];
          if (e.dataset) {
            result[1] = e.dataset + ":" + result[1];
          }
          return result;
        });
      } else {
        let data = await this.internalFs.getTreeIndexAndPath(
          options.name || "."
        );
        if (data.name) {
          options.dataset = data.name;
        }
        options.tree = data.tree;
        return await this._findRecent(options);
      }
    }

    // Regular find mode
    if (!options.name && options.keywords) {
      options.name = options.keywords;
    }
    let splitted = options.name.split(":");
    let withDataset = splitted.length > 1;
    if (options.global || (splitted[1] && !splitted[0])) {
      if (withDataset) {
        options.name = splitted[1];
      }
      if (!options.name) {
        throw new Error("Keywords required");
      }
      let datasetInfo = await this.internalFs.getDatasetsInfo();
      let results = [];
      for (let dataset of datasetInfo) {
        if (options.global && !options.trashToo && dataset.index === 1) {
          continue;
        }
        await this.internalFs.mountTree(dataset.index);
        options.tree = this.internalFs.trees[dataset.index];
        options.dataset = dataset.name;
        results = results.concat(await this._find(options));
      }
      return results;
    } else {
      let data = await this.internalFs.getTreeIndexAndPath(options.name);
      if (withDataset) {
        options.dataset = data.name;
      }
      options.name = data.path;
      options.tree = data.tree;
      return await this._find(options);
    }
  }

  async _find(options) {
    let start = options.tree[options.root ? "root" : "workingNode"];
    return (await start.find(options)).map((e) => {
      if (options.dataset) {
        e[1] = options.dataset + ":" + e[1];
      }
      return e;
    });
  }

  async _findRecent(options) {
    let rawResults = await this._findRecentRaw(options);

    // Sort by timestamp (most recent first) and limit
    rawResults.sort((a, b) => {
      return Node.sortEntry(a.ts, b.ts);
    });

    // Limit results
    if (options.limit && rawResults.length > options.limit) {
      rawResults = rawResults.slice(0, options.limit);
    }

    // Format results to match regular find output
    return rawResults.map((e) => {
      let result = [
        Node.hashVersion(e.ts),
        e.path + (e.isDir ? "/" : ""),
        e.name,
        undefined,
      ];
      if (options.dataset) {
        result[1] = options.dataset + ":" + result[1];
      }
      return result;
    });
  }

  async _findRecentRaw(options) {
    let start = options.tree[options.root ? "root" : "workingNode"];
    let results = [];
    let re = options.name ? Node.getFindRe(options) : null;

    // Recursively collect all entries with their timestamps
    await this._collectRecentEntries(start, results, options, re);

    // Add dataset info to results for global mode
    if (options.dataset) {
      results = results.map((e) => {
        e.dataset = options.dataset;
        return e;
      });
    }

    return results;
  }

  async _collectRecentEntries(node, results, options, re) {
    // Skip root node
    if (Node.isRoot(node)) {
      // Process children
      if (node.children) {
        for (let id in node.children) {
          await this._collectRecentEntries(
            node.children[id],
            results,
            options,
            re
          );
        }
      }
      return;
    }

    // Process current node if it has versions
    if (node.versions && node.lastTs) {
      let name = node.getName();
      let path = node.getPath();
      let isDir = Node.isDir(node);

      // Filter by keywords if provided
      if (re) {
        if (re.test(name)) {
          results.push({
            ts: node.lastTs,
            name: name,
            path: path,
            isDir: isDir,
          });
        } else if (
          options.content &&
          Node.isFile(node) &&
          node.type === config.types.TEXT &&
          options.tree
        ) {
          // Check content if content option is enabled
          try {
            let { content } = await options.tree.getEntryDetails(
              node,
              node.lastTs
            );
            if (re.test(content || "")) {
              results.push({
                ts: node.lastTs,
                name: name,
                path: path,
                isDir: isDir,
              });
            }
          } catch (e) {
            // Ignore errors when reading content
          }
        }
      } else {
        // No keyword filter, include all entries
        results.push({
          ts: node.lastTs,
          name: name,
          path: path,
          isDir: isDir,
        });
      }
    }

    // Process children
    if (node.children) {
      for (let id in node.children) {
        await this._collectRecentEntries(
          node.children[id],
          results,
          options,
          re
        );
      }
    }
  }

  formatResult(result, re) {
    if (re.test(result)) {
      return result.replace(re, (a) => chalk.bold(a));
    } else {
      return result;
    }
  }

  formatIndex(len, i) {
    return " ".repeat(len.toString().length - i.toString().length) + i;
  }

  formatList(list, options) {
    let re = options.name ? Node.getFindRe(options) : null;
    let i = 0;
    const setCache = (i, e) => {
      this.prompt.setCache("findResult", i, e);
    };
    return list.map((e) => {
      i++;
      let k = this.formatIndex(list.length, i);
      if (options.all) {
        let p = e[1].split("/");
        let l = p.length;
        let c = p[l - 1] ? p[l - 1] : p[l - 2];
        if (e[2] && e[2] !== c) {
          e[2] = re ? this.formatResult(e[2], re, options.name) : e[2];
        } else {
          e[2] = undefined;
        }
        setCache(i, e);
        return [
          k,
          "  ",
          chalk.yellow(e[0]),
          "  ",
          re ? this.formatResult(e[1], re, options.name) : e[1],
          "  ",
          e[2],
        ].join("");
      } else {
        setCache(i, e);
        return [
          k,
          "  ",
          re ? this.formatResult(e[1], re, options.name) : e[1],
        ].join("");
      }
    });
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      // In recent mode, keywords are optional
      if (options.recent) {
        options.name = options.keywords;
        try {
          this.lastResult = await this.find(options);
          let list = this.formatList(this.lastResult, options);
          if (list && list.length) {
            this.Logger.grey(
              `${list.length} result${list.length > 1 ? "s" : ""} found:`
            );
            for (let l of list) this.Logger.reset(l);
          } else {
            this.Logger.grey("No results.");
          }
        } catch (e) {
          this.Logger.red(e.message);
        }
      } else {
        // Regular find mode requires keywords
        options.name = options.keywords;
        if (options.name) {
          try {
            this.lastResult = await this.find(options);
            let list = this.formatList(this.lastResult, options);
            if (list && list.length) {
              this.Logger.grey(
                `${list.length} result${list.length > 1 ? "s" : ""} found:`
              );
              for (let l of list) this.Logger.reset(l);
            } else {
              this.Logger.grey("No results.");
            }
          } catch (e) {
            this.Logger.red(e.message);
          }
        } else {
          this.Logger.grey("Missing parameters");
        }
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Find;
