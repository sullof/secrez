const util = require("util");
const path = require("path");
const fs = require("fs-extra");
const { config, Entry, ConfigUtils } = require("@secrez/core");
const Node = require("./Node");
const Tree = require("./Tree");
const { ENTRY_EXISTS } = require("./Messages");
const GitConflictChecker = require("./GitConflictChecker");

class InternalFs {
  constructor(secrez) {
    if (secrez.constructor.name === "Secrez") {
      this.secrez = secrez;
      this.dataPath = secrez.config.dataPath;
      this.trees = [new Tree(secrez), new Tree(secrez, 1)];
      this.treeIndex = 0;
      this.tree = this.trees[0];
      this.gitConflictChecker = new GitConflictChecker(secrez);
    } else {
      throw new Error(
        "InternalFs requires a Secrez instance during construction"
      );
    }
  }

  async init() {
    // eslint-disable-next-line require-atomic-updates
    await this.tree.load();
    await this.trashToBeDeleted(0);

    // Capture initial git state when entering the account
    await this.gitConflictChecker.captureInitialState();
  }

  getFullPath(entry) {
    return path.join(this.dataPath, entry.encryptedName);
  }

  cleanPreviousRootEntry() {
    for (let t of this.trees) {
      delete t.previousRootEntry;
    }
  }

  async make(options) {
    let data = await this.getTreeIndexAndPath(options.path);
    options.path = data.path;
    let tree = data.tree;
    let p = this.normalizePath(options.path);
    if (Node.isFile(options) && options.versionIfExists) {
      p = path.join(path.dirname(p), await tree.getVersionedBasename(p));
    }
    let [ancestor, remainingPath] = tree.root.getChildFromPath(p, true);
    p = remainingPath.split("/");
    let len = p.length;
    let child;
    for (let i = 0; i < len; i++) {
      let notLast = i < len - 1;
      let entry = new Entry({
        id: options.id,
        name: p[i],
        type: notLast ? config.types.DIR : options.type,
      });
      if (Node.isFile(options) && options.content) {
        entry.set({ content: options.content });
      }
      child = await tree.add(ancestor, entry);
      if (notLast) {
        ancestor = child;
      }
    }
    return child;
  }

  normalizePath(p, index) {
    if (!p || typeof p !== "string") {
      throw new Error('The "path" option must exist and be of type string');
    }
    p = p.replace(/^~\/+/, "/").replace(/~+/g, "");
    let tree = index ? this.trees[index] : this.tree;
    p = path.resolve(tree.workingNode.getPath(), p);
    for (let v of p.split("/")) {
      if (v.length > 255) {
        throw new Error("File names cannot be longer that 255 characters");
      }
    }
    return Entry.sanitizePath(p);
  }

  async getIndexes(options = {}) {
    let indexFrom = this.treeIndex;
    let indexTo = this.treeIndex;
    let foundFrom;
    let foundTo;

    if (options.to || options.from) {
      for (let dataset of await this.getDatasetsInfo()) {
        if (dataset.name.toLowerCase() === (options.to || "").toLowerCase()) {
          indexTo = dataset.index;
          foundTo = true;
        }
        if (dataset.name.toLowerCase() === (options.from || "").toLowerCase()) {
          indexFrom = dataset.index;
          foundFrom = true;
        }
      }
      if ((options.to && !foundTo) || (options.from && !foundFrom)) {
        throw new Error("Target dataset does not exist");
      }
    }
    return [indexFrom, indexTo];
  }

  async change(options = {}) {
    if (!options.newPath && typeof options.content !== "undefined") {
      options.newPath = options.path;
    }
    let dataFrom = await this.getTreeIndexAndPath(options.path);
    let indexFrom = dataFrom.index;
    let treeFrom = dataFrom.tree;
    options.path = dataFrom.path;
    let dataTo = await this.getTreeIndexAndPath(options.newPath);
    let indexTo = dataTo.index;
    let treeTo = dataTo.tree;
    options.newPath = dataTo.path;

    let cross = indexTo !== indexFrom;
    let fromTrash = options.removing && indexFrom === 1;

    let p = this.normalizePath(options.path, indexFrom);
    let n;

    if (options.newPath) {
      n = this.normalizePath(options.newPath, indexTo);
      if (p === n && indexFrom === indexTo) {
        n = undefined;
      }
    }

    let node;
    try {
      node = treeFrom.root.getChildFromPath(p);
    } catch (e) {}
    if (!node) {
      throw new Error("Path does not exist");
    }
    let originalParentId = node.parent.id;
    let entry = new Entry(Object.assign(options, node.getEntry()));
    let ancestor, remainingPath;
    try {
      let result = n ? treeTo.root.getChildFromPath(n, true) : [];
      ancestor = result[0];
      remainingPath = result[1];
    } catch (e) {
      if (e.message === util.format(ENTRY_EXISTS, path.basename(n))) {
        let dir = treeTo.root.getChildFromPath(n);
        if (dir && Node.isDir(dir)) {
          ancestor = dir;
          remainingPath = path.basename(p);
        }
      }
    }
    if (ancestor) {
      remainingPath = remainingPath.split("/");
      if (remainingPath.length > 1) {
        throw new Error("Cannot move a node to a not existing folder");
      }
      entry.name = remainingPath[0];
      if (ancestor.id !== node.parent.id || cross) {
        entry.parent = ancestor;
      }
    }

    if (Node.isFile(entry)) {
      node.content = (await treeFrom.getEntryDetails(node)).content;
      if (typeof entry.content === "undefined") {
        entry.content = node.content;
      }
    }

    if (!n && !cross && entry.content === node.content) {
      return node;
    }
    entry.preserveContent = true;

    if (
      entry.parent &&
      (!node.parent || entry.parent.id !== node.parent.id || cross)
    ) {
      entry.name = await treeTo.getVersionedBasename(
        path.join(entry.parent.getPath(), entry.name),
        entry.parent
      );
    }
    if (entry.name !== node.getName() || entry.content !== node.getContent()) {
      entry = this.secrez.encryptEntry(entry);
      await treeFrom.saveEntry(entry);
    }

    if (cross || fromTrash) {
      await this.moveOrUnlink(node, indexFrom, indexTo, fromTrash, entry);
      let originalParent = treeFrom.root.findChildById(originalParentId, true);
      originalParent.removeChild(node);
      if (cross) {
        entry.parent.add(node);
      }
      await treeFrom.save();
      await treeTo.save();
    } else {
      node.move(entry);
      await treeFrom.save();
    }
    return node;
  }

  async moveOrUnlink(node, indexFrom, indexTo, unlink, entry) {
    if (entry && node.getName() !== entry.name) {
      node.move(entry);
      await this.trees[indexFrom].save();
    }
    let allFiles = await this.trees[indexFrom].getAllDataFiles(node);
    let fromDatapath = ConfigUtils.getDatasetPath(
      this.secrez.config,
      indexFrom
    );
    let toDatapath = ConfigUtils.getDatasetPath(this.secrez.config, indexTo);
    for (let file of allFiles) {
      if (await fs.pathExists(path.join(fromDatapath, file))) {
        if (unlink) {
          await fs.unlink(path.join(fromDatapath, file));
        } else {
          await fs.move(
            path.join(fromDatapath, file),
            path.join(toDatapath, file)
          );
        }
      }
    }
  }

  async remove(options = {}, node) {
    return await this.change(
      Object.assign(options, {
        removing: true,
        to: "trash",
        newPath: "/",
      })
    );
  }

  async getTreeIndexAndPath(p = "./") {
    let data = {
      tree: this.tree,
      name: this.tree.name,
      index: this.treeIndex,
      path: p || "./",
    };
    let datasetAndPath = p.split(":");
    if (datasetAndPath.length > 1) {
      let dataset = await this.getDatasetInfo(datasetAndPath[0]);
      if (dataset === false) {
        throw new Error("Dataset not found");
      } else if (dataset.index !== this.treeIndex) {
        await this.mountTree(dataset.index);
        data.index = dataset.index;
        data.tree = this.trees[dataset.index];
        data.name = this.trees[dataset.index].name;
      }
      data.path = datasetAndPath[1] || "./";
      data.updated = true;
    }
    return data;
  }

  async getFileList(options = {}, addSlashIfDir, returnNodes) {
    try {
      return await this.fileList(options, addSlashIfDir, returnNodes);
    } catch (e) {
      return [];
    }
  }

  async fileList(options = {}, addSlashIfDir, returnNodes) {
    if (typeof options === "string") {
      options = { path: options };
    }
    if (Array.isArray(options.path)) {
      options.path = options.path[options.path.length - 1];
    }
    let data = await this.getTreeIndexAndPath(options.path);
    // console.log(data)
    let datasets = [];
    if (!data.updated && !options.ignoreDatasets) {
      datasets = (await this.getDatasetsInfo())
        .map((e) => e.name)
        .filter((e) =>
          RegExp(
            "^" +
              (options.path || "").replace(/\*/g, "\\*").replace(/\?/g, "\\?")
          ).test(e)
        )
        .map((e) => e + ":/");
    }
    let tree = data.tree;
    let files = data.path;
    let p = tree.getNormalizedPath(files);
    let end = path.basename(p);
    let node;
    if (!/\?|\*/.test(end)) {
      end = undefined;
    }
    try {
      if (/\?|\*/.test(path.basename(p))) {
        throw new Error();
      }
      node = tree.root.getChildFromPath(p);
    } catch (e) {
      end = path.basename(p);
      node = tree.root.getChildFromPath(path.dirname(p));
    }
    const getType = (n) => {
      if (addSlashIfDir) {
        return Node.isDir(n) ? "/" : "";
      }
      return "";
    };
    if (node) {
      if (Node.isFile(node) || (options.asIs && !end)) {
        if (
          (Node.isFile(node) && options.only === "d") ||
          (Node.isDir(node) && options.only === "f")
        ) {
          return [];
        }
        return returnNodes ? [node] : [getType(node) + node.getName()];
      } else {
        let children = returnNodes ? [] : datasets;
        for (let id in node.children) {
          let child = node.children[id];
          if (
            (Node.isFile(child) && options.only === "d") ||
            (Node.isDir(child) && options.only === "f")
          ) {
            continue;
          }
          children.push(returnNodes ? child : child.getName() + getType(child));
        }
        if (end) {
          end =
            "^" +
            end
              .replace(/\?/g, ".{1}")
              .replace(/\*/g, ".*")
              .replace(/\\ /g, " ") +
            (options.forAutoComplete ? "" : "(|\\/)$");
          let re = RegExp(end);
          children = children.filter((e) => {
            return re.test(returnNodes ? e.getName() : e);
          });
        }
        return children;
      }
    }
    return [];
  }

  async mountTrash() {
    await this.mountTree(1);
    return this.trees[1];
  }

  async trashToBeDeleted(index) {
    let trash = await this.mountTrash();
    let tree = this.trees[index];
    let fromTrash = index === 1;
    if (tree.toBeDeleted.length) {
      for (let node of tree.toBeDeleted) {
        if (!fromTrash) {
          trash.root.add(node);
        }
        await this.moveOrUnlink(node, index, 1, fromTrash);
      }
      await tree.save();
      await trash.save();
      tree.toBeDeleted = [];
    }
  }

  async mountTree(index, makeActive) {
    if (!this.trees[index]) {
      this.trees[index] = new Tree(this.secrez, index);
    }
    if (this.trees[index].status !== Tree.statutes.LOADED) {
      await this.trees[index].load();
      await this.trashToBeDeleted(index);
    }
    if (makeActive) {
      this.tree = this.trees[index];
      this.treeIndex = index;
    }
  }

  async getDatasetsInfo() {
    let result = [
      {
        index: 0,
        name: "main",
      },
      {
        index: 1,
        name: "trash",
      },
    ];
    if (!this.treeCache) {
      this.treeCache = [];
    }
    let datasets = ConfigUtils.listDatasets(this.secrez.config);
    if (datasets.length > 2) {
      for (let i = 2; i < datasets.length; i++) {
        let name;
        if (this.trees[i]) {
          name = this.trees[i].name;
        } else if (this.treeCache[i]) {
          name = this.treeCache[i];
        } else {
          let tree = new Tree(this.secrez, i);
          name = await tree.getName();
          this.treeCache[i] = name;
        }
        result.push({
          index: i,
          name,
        });
      }
    }
    return result;
  }

  async deleteDataset(index) {
    if (ConfigUtils.deleteDataset(this.secrez.config, index)) {
      delete this.trees[index];
      this.deleteFromTreeCache(index);
      return true;
    } else {
      return false;
    }
  }

  async getDatasetInfo(name) {
    let datasets = await this.getDatasetsInfo();
    for (let dataset of datasets) {
      if (dataset.name.toLowerCase() === name.toLowerCase()) {
        return dataset;
      }
    }
    return false;
  }

  updateTreeCache(index, name) {
    this.treeCache[index] = name;
  }

  deleteFromTreeCache(index) {
    delete this.treeCache[index];
  }

  async checkGitSyncStatus() {
    // First, check for external repository changes WITHOUT using cache
    // This is critical - we must always get fresh git status to detect external changes
    const currentStatus = await this.gitConflictChecker.getGitStatus();
    const riskInfo = this.gitConflictChecker.hasConflictRisk(currentStatus);

    if (riskInfo.hasRisk) {
      const warningMessage = this.gitConflictChecker.getWarningMessage(
        currentStatus,
        riskInfo
      );
      return {
        hasRisk: true,
        riskType: riskInfo.type,
        allowBypass: riskInfo.allowBypass,
        message: warningMessage,
        status: currentStatus,
      };
    }

    return {
      hasRisk: false,
      riskType: null,
      allowBypass: true,
      message: null,
      status: currentStatus,
    };
  }
}

module.exports = InternalFs;
