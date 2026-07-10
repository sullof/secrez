const fs = require("fs-extra");
const path = require("path");
const Node = require("./Node");
const {
  config,
  Entry,
  ConfigUtils,
  VaultPermissions,
} = require("@secrez/core");
const Crypto = require("@secrez/crypto");

class Tree {
  constructor(secrez, datasetIndex = 0) {
    this.alerts = [];
    if (secrez.constructor.name === "Secrez") {
      let dataPath = secrez.config.dataPath;
      if (datasetIndex) {
        dataPath = ConfigUtils.setAndGetDataset(secrez.config, datasetIndex);
      }
      this.datasetIndex = datasetIndex;
      this.secrez = secrez;
      Node.setCache(secrez.cache);
      this.config = secrez.config;
      this.dataPath = dataPath;
      this.status = Tree.statutes.UNLOADED;
      this.errors = [];
      this.toBeDeleted = [];
    } else {
      throw new Error("Tree requires a Secrez instance during construction");
    }
  }

  async getAllFiles() {
    return (await fs.readdir(this.dataPath)).filter(
      (file) => !/^\./.test(file)
    );
  }

  async decryptSecret(file) {
    let entry = new Entry({
      encryptedName: file,
      preserveContent: true,
    });
    if (file[file.length - 1] === "$") {
      // there is an extraName
      let content = await fs.readFile(path.join(this.dataPath, file), "utf8");
      content = content.split("$");
      entry.set({
        encryptedName: file.substring(0, 254) + content[1],
      });
    }
    return [entry, this.secrez.decryptEntry(entry)];
  }

  async load() {
    if (this.status === Tree.statutes.LOADED) {
      return;
    }

    let files = await this.getAllFiles();
    let allIndexes = [];
    let allSecrets = [];
    let allNames = [];
    let allTags = [];

    for (let file of files) {
      let [entry, decryptedEntry] = await this.decryptSecret(file);
      if (decryptedEntry.type === config.types.ROOT) {
        let content = await fs.readFile(path.join(this.dataPath, file), "utf8");
        entry.set({
          encryptedContent: content.split("$")[0],
        });
        decryptedEntry = this.secrez.decryptEntry(entry);
        allIndexes.push(decryptedEntry);
      } else if (decryptedEntry.type === config.types.TAGS) {
        allTags.push(decryptedEntry);
      } else if (decryptedEntry.type === config.types.NAME) {
        allNames.push(decryptedEntry);
      } else {
        allSecrets.push(decryptedEntry);
      }
    }

    if (this.datasetIndex === 0) {
      this.name = "main";
    } else if (this.datasetIndex === 1) {
      this.name = "trash";
    } else if (allNames.length) {
      allNames.sort(Node.sortEntry);
      this.name = allNames[0].name;
    }

    if (allSecrets.length) {
      allSecrets.sort(Node.sortEntry);
      if (!allIndexes.length) {
        this.root = Node.initGenericRoot();
        this.root.datasetIndex = this.datasetIndex;
        this.workingNode = this.root;
        this.alerts = [
          'A valid tree is missing.\nThe following entries have been recovered and put in the folder "/recovered":',
        ].concat(await this.recoverUnlisted(allSecrets));
        await this.loadTags(allTags);
        await this.save();
      } else {
        allIndexes.sort(Node.sortEntry);
        let allSecretsFiles = allSecrets.map((e) => e.encryptedName);
        let json = JSON.parse(allIndexes[0].content);
        this.root = Node.fromJSON(json, this.secrez, allSecretsFiles);

        this.root.datasetIndex = this.datasetIndex;
        this.workingNode = this.root;

        // verify the tree
        let allFilesOnTree = Tree.getAllFilesOnTree(this.root).sort();
        const filesNotOnTree = [];
        for (let i = 0; i < allSecretsFiles.length; i++) {
          let file = allSecretsFiles[i];
          if (!allFilesOnTree.includes(file)) {
            filesNotOnTree.push(allSecrets[i]);
          }
        }
        if (filesNotOnTree.length) {
          let toBeRecovered = {};
          let recoveredEntries = [];
          FOR: for (let i = 1; i < allIndexes.length; i++) {
            json = JSON.parse(allIndexes[i].content);
            let root = Node.fromJSON(json, this.secrez, allSecretsFiles);
            allFilesOnTree = Tree.getAllFilesOnTree(root).sort();
            for (let j = 0; j < filesNotOnTree.length; j++) {
              let f = filesNotOnTree[j];
              if (allFilesOnTree.includes(f.encryptedName)) {
                let node = root.findChildById(f.id);
                if (node) {
                  let k = allSecretsFiles.indexOf(f.encryptedName);
                  toBeRecovered[node.getPath()] = allSecrets[k];
                  filesNotOnTree.splice(j, 1);
                  j--;
                }
              }
              if (!files.length) {
                break FOR;
              }
            }
          }
          let paths = Object.keys(toBeRecovered).sort();
          for (let p of paths) {
            let entry = toBeRecovered[p];
            // it can generate duplicate names
            let parentPath = p.replace(/\/[^\\/]+$/, "");
            if (parentPath) {
              // check if exists on with the same name
              // if so, the recovered one is trashed
              try {
                let parent = this.root.getChildFromPath(parentPath);
                if (parent) {
                  entry.parent = parent;
                  if (await this.addAsChildOrVersion(parent, entry)) {
                    recoveredEntries.push(p);
                  }
                  continue;
                }
              } catch (e) {}
            }
            entry.parent = this.root;
            if (await this.addAsChildOrVersion(this.root, entry)) {
              recoveredEntries.push(p);
            }
          }
          if (filesNotOnTree.length || recoveredEntries.length) {
            this.alerts = ["Some files/versions have been recovered:"];
            if (recoveredEntries.length) {
              for (let i = 0; i < recoveredEntries.length; i++) {
                if (!i) {
                  continue;
                }
                if (
                  recoveredEntries[i - 1].substring(
                    0,
                    recoveredEntries[i].length
                  ) === recoveredEntries[i]
                ) {
                  recoveredEntries.splice(i--, 1);
                }
              }

              this.alerts = this.alerts.concat(
                this.optimizeResults(recoveredEntries)
              );
            }
            if (filesNotOnTree.length) {
              this.alerts = this.alerts.concat(
                this.optimizeResults(await this.recoverUnlisted(filesNotOnTree))
              );
            }
            await this.save();
          }
        }

        for (let i = 2; i < allIndexes.length; i++) {
          await fs.unlink(
            path.join(this.dataPath, allIndexes[i].encryptedName)
          );
        }
      }
      await this.loadTags(allTags);
    } else {
      this.root = Node.initGenericRoot();
      this.root.datasetIndex = this.datasetIndex;
      this.workingNode = this.root;
      await this.loadTags();
    }
    this.status = Tree.statutes.LOADED;
  }

  optimizeResults(entries) {
    entries.reverse();
    for (let i = 0; i < entries.length; i++) {
      if (!i) {
        continue;
      }
      if (entries[i - 1].substring(0, entries[i].length) === entries[i]) {
        entries.splice(i--, 1);
      }
    }
    return entries.reverse();
  }

  datedName(prefix) {
    return (
      prefix +
      "_" +
      new Date()
        .toISOString()
        .substring(0, 19)
        .replace(/(T|:|-)/g, "")
    );
  }

  async recoverUnlisted(allSecrets) {
    let recName = this.datedName(this.config.specialName.RECOVERED);
    this.root.datasetIndex = this.datasetIndex;
    this.workingNode = this.root;
    let recoveredEntries = [];
    let recovered;
    for (let entry of allSecrets) {
      if (!recovered) {
        try {
          recovered = await this.add(
            this.root,
            new Entry({
              name: recName,
              type: this.config.types.DIR,
            })
          );
        } catch (e) {}
      }
      if (entry.type === this.config.types.DIR && entry.name === recName) {
        await fs.unlink(path.join(this.dataPath, entry.encryptedName));
      } else {
        entry.parent = recovered;
        try {
          recovered.getChildFromPath(entry.name);
          entry.name = await this.getVersionedBasename(
            `/${recName}/${entry.name}`
          );
        } catch (e) {}
        recovered.add(new Node(entry));
        recoveredEntries.push(`/${recName}/${entry.name}`);
      }
    }
    await this.save();
    return recoveredEntries;
  }

  async addAsChildOrVersion(parent, entry) {
    // console.log(parent.getPath(), entry.name)
    let done = false;
    let name = entry.name;
    let existentChild = parent.findDirectChildByName(name, entry.id);
    if (existentChild) {
      if (existentChild.type === entry.type) {
        let temporaryNode = new Node(entry);
        // if it is a dir, it has the same name, we don't need it. But
        if (Node.isFile(entry)) {
          let details = await this.getEntryDetails(existentChild);
          let tempDetails = await this.getEntryDetails(temporaryNode);
          if (details.content !== tempDetails.content) {
            entry.content = tempDetails.content;
            existentChild.move(entry);
            done = true;
          }
        }
        this.toBeDeleted.push(temporaryNode);
      } else {
        entry.name = await this.getVersionedBasename(existentChild.getPath());
        parent.add(new Node(entry));
        done = true;
      }
    } else {
      parent.add(new Node(entry));
      done = true;
    }
    return done;
  }

  async getEntryDetails(node, ts) {
    let content;
    if (Node.isFile(node)) {
      content = node.getContent(ts);
      if (typeof content === "undefined") {
        // must be read from disk
        let entry = node.getEntry(ts);
        let fullPath = this.getFullPath(entry);
        let [encryptedContent, extraName] = (
          await fs.readFile(fullPath, "utf8")
        ).split("$");
        entry.encryptedContent = encryptedContent;
        entry.extraName = extraName;
        let decryptedEntry = this.secrez.decryptEntry(entry);
        content = node.versions[ts ? ts : node.lastTs].content =
          decryptedEntry.content;
      }
    }
    return {
      type: node.type,
      id: node.id,
      name: node.getName(ts),
      content,
      ts: ts || node.lastTs,
    };
  }

  static getAllFilesOnTree(node) {
    // get all the version currently in the tree to check for anomalies
    let results = [];
    if (node.versions) {
      for (let ts in node.versions) {
        let version = node.versions[ts];
        if (version.file) {
          results.push(version.file);
        }
      }
    }
    if (node.children) {
      for (let id in node.children) {
        results = results.concat(Tree.getAllFilesOnTree(node.children[id]));
      }
    }
    return results;
  }

  getNormalizedPath(p = "/") {
    p = p.replace(/^~+/, "~").replace(/^~\/+/, "/").replace(/~+/g, "");
    if (!p) {
      p = "/";
    }
    let resolvedDir = path.resolve(this.workingNode.getPath(), p);
    let normalized = path.normalize(resolvedDir);
    return normalized;
  }

  async getVersionedBasename(p, node = this.root) {
    p = this.getNormalizedPath(p);
    let dir = path.dirname(p);
    let fn = path.basename(p);
    let ext = path.extname(p);
    let num = "";
    if (ext) {
      fn = fn.replace(RegExp(ext.replace(/\./, "\\.") + "$"), "");
    }
    if (/^\.\d+$/.test(ext)) {
      num = parseInt(ext.substring(1));
      ext = "";
    } else if (/\.\d+$/.test(fn)) {
      fn = fn.split(".");
      num = parseInt(fn[1]);
      fn = fn[0];
    }
    fn = fn.split(/\.\d+$/);
    let name = fn + (num ? "." + num : "") + ext;
    let v = num || 2;
    for (;;) {
      try {
        node.getChildFromPath(path.join(dir, name));
        name = fn + "." + v++ + ext;
      } catch (e) {
        return name;
      }
    }
  }

  getFullPath(entry) {
    return path.join(this.dataPath, entry.encryptedName);
  }

  async unsaveEntry(entry) {
    let fullPath = this.getFullPath(entry);
    if (await fs.pathExists(fullPath)) {
      await fs.unlink(fullPath);
    }
  }

  async add(parent, entry, force) {
    /* istanbul ignore if  */
    if (entry.id && !force) {
      throw new Error("A new entry cannot have a pre-existent id");
    }
    if (!entry.id) {
      entry.set({ id: Crypto.getRandomId(Node.getCache().list("id")) });
    }
    entry.preserveContent = true;
    entry = this.secrez.encryptEntry(entry);
    try {
      await this.saveEntry(entry);
      let node = new Node(entry, force);
      parent.add(node);
      await this.save();
      return node;
    } catch (e) {
      /* istanbul ignore if  */
      // eslint-disable-next-line no-constant-condition
      if (true) {
        await this.unsaveEntry(entry);
        throw e;
      }
    }
  }

  async update(node, entry) {
    /* istanbul ignore if  */
    if (!node || !entry) {
      throw new Error("A Node and an Entry are required");
    }
    entry.preserveContent = true;
    entry = this.secrez.encryptEntry(entry);
    try {
      await this.saveEntry(entry);
      node.move(entry);
      await this.save();
      return node;
    } catch (e) {
      /* istanbul ignore if  */
      // eslint-disable-next-line no-constant-condition
      if (true) {
        await this.unsaveEntry(entry);
        throw e;
      }
    }
  }

  async saveEntry(entry) {
    let fullPath = this.getFullPath(entry);
    /* istanbul ignore if  */
    if (await fs.pathExists(fullPath)) {
      throw new Error("File already exists");
    }
    let encryptedContent =
      entry.encryptedContent || entry.extraName
        ? (entry.encryptedContent || "") +
          (entry.extraName ? "$" + entry.extraName : "")
        : "";
    await VaultPermissions.writeFile(fullPath, encryptedContent);
    return entry;
  }

  disableSave() {
    this.doNotSave = true;
  }

  isSaveEnabled() {
    return this.doNotSave ? false : true;
  }

  enableSave() {
    delete this.doNotSave;
  }

  async save() {
    if (this.doNotSave) {
      // used during imports with many entries, to optimize the performances
      return;
    }
    let rootEntry = this.root.getEntry();
    if (this.previousRootEntry) {
      await this.unsaveEntry(this.previousRootEntry);
    }
    rootEntry.set({
      name: Crypto.getRandomBase58String(4),
      content: JSON.stringify(
        this.root.toCompressedJSON(null, null, await this.getAllFiles())
      ),
      preserveContent: true,
    });
    rootEntry = this.secrez.encryptEntry(rootEntry);
    await this.saveEntry(rootEntry);
    this.previousRootEntry = rootEntry;
  }

  async loadTags(allTags = []) {
    if (allTags.length) {
      allTags = allTags.sort(Node.sortEntry)[0];
      let content = await fs.readFile(
        path.join(this.dataPath, allTags.encryptedName),
        "utf8"
      );
      allTags.set({
        encryptedContent: content.split("$")[0],
      });
      allTags = this.secrez.decryptEntry(allTags);
      allTags.content = JSON.parse(allTags.content);
      this.tags = allTags;
    } else {
      this.tags = new Entry({
        type: config.types.TAGS,
        content: {},
      });
    }
  }

  async addTag(node, tags) {
    let content = this.tags.content;
    for (let tag of tags) {
      if (!content[tag]) {
        content[tag] = [];
      }
      if (!content[tag].includes(node.id)) {
        content[tag].push(node.id);
      }
      this.tagsChanged = true;
    }
    await this.saveTags();
  }

  getTags(node) {
    return this.reverseTags()[node.id] || [];
  }

  async removeTag(node, tags) {
    let content = this.tags.content;
    for (let tag of tags) {
      if (content[tag].includes(node.id)) {
        content[tag] = content[tag].filter((e) => e !== node.id);
        this.tagsChanged = true;
      }
    }
    await this.saveTags();
  }

  listTags() {
    let result = [];
    let tags = this.tags.content;
    for (let t of Object.keys(tags).sort()) {
      result.push(`${t} (${tags[t].length})`);
    }
    return result.sort();
  }

  getNodesByTag(list) {
    let result = [];
    let tags = this.tags.content;
    let tag = [];
    if (list.length === 1) {
      tag = tags[list[0]] || [];
    } else {
      let ttag = {};
      for (let l of list) {
        let tmp = this.tags.content[l] || [];
        for (let id of tmp) {
          ttag[id] = true;
        }
      }
      ttag = Object.keys(ttag);
      FOR: for (let id of ttag) {
        for (let s of list) {
          if (!tags[s].includes(id)) {
            continue FOR;
          }
        }
        tag.push(id);
      }
    }
    let rev;
    for (let id of tag) {
      if (!rev) {
        rev = this.reverseTags();
      }
      let node = this.root.findChildById(id);
      result.push([node.getPath(), rev[id].sort().join(" ")]);
    }
    return result;
  }

  reverseTags() {
    let reverse = {};
    for (let t in this.tags.content) {
      for (let id of this.tags.content[t]) {
        if (!reverse[id]) {
          reverse[id] = [];
        }
        reverse[id].push(t);
      }
    }
    return reverse;
  }

  async saveTags() {
    if (this.doNotSave || !this.tagsChanged) {
      return;
    }
    delete this.tagsChanged;
    let tags = new Entry(this.tags);
    if (this.previousTags) {
      await this.unsaveEntry(this.previousTags);
    }
    tags.set({
      name: Crypto.getRandomBase58String(4),
      content: JSON.stringify(tags.content),
      preserveContent: true,
    });
    tags = this.secrez.encryptEntry(tags);
    await this.saveEntry(tags, true);
    this.previousTags = tags;
  }

  validateDatasetName(name) {
    if (!/^[a-zA-Z]{1}\w{1,15}$/.test(name)) {
      throw new Error(
        "Dataset name must be alphanumeric, start with a letter, and at most 16 characters long"
      );
    }
  }

  async nameDataset(name) {
    if ([0, 1].includes(this.datasetIndex)) {
      throw new Error("Main and trash dataset cannot be renamed");
    }
    this.validateDatasetName(name);
    if (name !== this.name) {
      let entry = new Entry({
        name,
        id: config.specialId.NAME,
        type: config.types.NAME,
      });
      let encryptedEntry = this.secrez.encryptEntry(entry);
      await VaultPermissions.writeFile(
        path.join(this.dataPath, encryptedEntry.encryptedName),
        ""
      );
      this.name = name;
    }
  }

  async getAllDataFiles(node, files = []) {
    for (let ts in node.versions) {
      files.push(node.getFile(ts));
    }
    if (node.children) {
      for (let id in node.children) {
        await this.getAllDataFiles(node.children[id], files);
      }
    }
    return files;
  }

  async getName() {
    let files = (await fs.readdir(this.dataPath)).filter((file) =>
      RegExp(`^${this.config.types.NAME}`).test(file)
    );
    let allNames = [];
    for (let file of files) {
      // eslint-disable-next-line no-unused-vars
      let [entry, decryptedEntry] = await this.decryptSecret(file);
      allNames.push(decryptedEntry);
    }
    // console.log(allNames)
    allNames.sort(Node.sortEntry);
    return allNames[0].name;
  }
}

Tree.statutes = {
  UNLOADED: 0,
  LOADED: 1,
  BROKEN: 2,
};

module.exports = Tree;
