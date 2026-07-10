const path = require("path");
const fs = require("fs-extra");
const { VaultPermissions } = require("@secrez/core");

class DataCache {
  constructor(dataPath, secrez) {
    this.secrez = secrez;
    this.cache = {};
    this.encrypted = {};
    if (dataPath) {
      this.dataPath = dataPath;
      VaultPermissions.ensureDirSync(dataPath);
      this.ensured = {};
    }
  }

  async reset() {
    if (this.cache && process.env.NODE_ENV === "test") {
      if (this.dataPath) {
        await fs.emptyDir(this.dataPath);
      }
      this.cache = {};
      this.ensured = {};
      this.encrypted = {};
    }
  }

  initEncryption(...keys) {
    for (let key of keys) {
      this.encrypted[key] = true;
    }
  }

  async load(key) {
    if (this.dataPath) {
      this.ensure(key);
      let p = path.join(this.dataPath, key);
      let files = await fs.readdir(p);
      for (let i = 0; i < files.length; i++) {
        let content = await fs.readFile(path.join(p, files[i]), "utf8");
        if (this.encrypted[key]) {
          files[i] = {
            encryptedValue: files[i],
            value: this.secrez.decryptData(files[i], true),
          };
          if (content) {
            files[i].content = this.secrez.decryptData(content);
          }
        } else {
          files[i] = {
            value: files[i],
          };
          if (content) {
            files[i].content = content;
          }
        }
      }
      return this.puts(key, files, true);
    }
    return false;
  }

  async puts(key, data, dontSave) {
    if (!this.cache[key]) {
      this.cache[key] = {};
    }
    if (!Array.isArray(data)) {
      data = [data];
    }
    let counter = 0;
    for (let v of data) {
      if (typeof v === "string") {
        v = {
          value: v,
        };
      }
      if (!dontSave) {
        v = await this.save(key, v);
      }
      let value = v.value;
      delete v.value;
      this.cache[key][value] = v;
      counter++;
    }
    return counter;
  }

  list(key) {
    return Object.keys(this.get(key));
  }

  get(key, value) {
    let all = this.cache[key] || {};
    if (value) {
      all = all[value];
    }
    return all;
  }

  is(key, value) {
    return !!this.get(key, value);
  }

  ensure(key) {
    if (!this.ensured[key]) {
      VaultPermissions.ensureDirSync(path.join(this.dataPath, key));
      this.ensured[key] = true;
    }
  }

  async save(key, data) {
    if (this.dataPath) {
      this.ensure(key);
      let value = data.value;
      let content = data.content || "";
      if (this.encrypted[key]) {
        value = this.secrez.encryptData(value, true);
        content = content ? this.secrez.encryptData(content) : "";
      }
      let p = path.join(this.dataPath, key, value);
      let changed = true;
      if (await fs.pathExists(p)) {
        if ((await fs.readFile(p, "utf8")) === content) {
          changed = false;
        }
      }
      if (changed) {
        await VaultPermissions.writeFile(p, content);
      }
      if (this.encrypted[key]) {
        data.encryptedValue = value;
      }
      return data;
    }
    return data;
  }

  async remove(key, value) {
    let data = this.get(key, value);
    if (data) {
      if (this.dataPath) {
        let p = path.join(this.dataPath, key, data.encryptedValue || value);
        if (await fs.pathExists(p)) {
          await fs.unlink(p);
        }
      }
      delete this.cache[key][value];
      return true;
    } else {
      return false;
    }
  }
}

module.exports = DataCache;
