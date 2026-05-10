const crypto = require("crypto");
const { config, Entry } = require("@secrez/core");
const { isYaml, yamlParse, yamlStringify } = require("@secrez/utils");
const { Node } = require("@secrez/fs");

const DEFAULT_LENGTH = 12;
const DEFAULT_FIELD = "password";

const CHARSET = {
  a: "abcdefghijklmnopqrstuvwxyz",
  A: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "1": "0123456789",
  "#": '!@#$%^&*()-_=+[]{};:,.<>?',
};

const ALLOWED_KEYS = ["a", "A", "1", "#"];

const DEFAULT_SET_KEYS = [...ALLOWED_KEYS];

const MAX_LENGTH = 1024;

class Gen extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.gen = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.gen = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "set",
        alias: "s",
        type: String,
      },
      {
        name: "length",
        alias: "l",
        type: Number,
      },
      {
        name: "field",
        alias: "f",
        type: String,
      },
      {
        name: "path",
        completionType: "file",
        alias: "p",
        defaultOption: true,
        type: String,
      },
    ];
  }

  help() {
    return {
      description: [
        "Generates a strong random password, prints it, and optionally saves it to a file.",
        `Default length is ${DEFAULT_LENGTH} (raised if subsets need more slots); default charset is aA1# (lower, upper, digits, symbols). `,
        "Use --set (-s) to pick subsets with a, A, 1, # in any order; duplicates are ignored. If you pass -s, it must include a charset value.",
        "With --path (-p): new plaintext files contain only the password; .yml / .yaml cards get a field (default \"password\"; use --field / -f to choose another key). Existing files are updated accordingly (Totp-like merge on YAML).",
      ],
      examples: [
        ["gen", `Print a ${DEFAULT_LENGTH}-character password (full aA1#).`],
        [
          "gen -s a",
          `Lowercase only; effective default length is max(${DEFAULT_LENGTH}, number of subsets).`,
        ],
        ['gen --set "#A1a"', "Same subsets as default; `#` denotes symbol characters."],
        ["gen -l 20", "Twenty characters with default aA1#."],
        ["gen -l 16 -s aA", "Letters only (min length 2), 16 characters."],
        ["gen secrets/app.yml", 'Generate and merge into yaml field "password" (create card if missing).'],
        [
          "gen site.yml -f api_key",
          'YAML only: set or overwrite field "api_key".',
        ],
      ],
    };
  }

  /**
   * `charsetKeys`: unique subset keys; order irrelevant (caller normalizes via parseSetSpec or default).
   * Guarantees at least one character from each subset.
   */
  static generatePassword(length, charsetKeys) {
    let subsets = charsetKeys.map((k) => CHARSET[k]);
    let required = subsets.map((pool) => Gen._pickChar(pool));
    let alphabet = subsets.join("");
    while (required.length < length) {
      required.push(Gen._pickChar(alphabet));
    }
    Gen._shuffle(required);
    return required.join("");
  }

  /** Parses `-s` value into ordered unique keys; throws if invalid. */
  static parseSetSpec(spec) {
    if (typeof spec !== "string") {
      throw new Error(
        '"--set" requires a charset value (e.g. aA1#). Order does not matter.'
      );
    }
    let trimmed = spec.trim();
    if (!trimmed.length) {
      throw new Error(
        '"--set" requires a charset value (e.g. aA1#). Order does not matter.'
      );
    }
    let seen = new Set();
    let keys = [];
    for (let ch of trimmed) {
      if (!CHARSET.hasOwnProperty(ch)) {
        throw new Error(
          `Invalid charset character "${ch}". Use only: a (lower), A (upper), 1 (digits), # (symbols).`
        );
      }
      if (!seen.has(ch)) {
        seen.add(ch);
        keys.push(ch);
      }
    }
    return keys;
  }

  /** Validates `-l`; `null` means flag without a valid numeric value (incl. non-integer parsing). */
  static resolveChosenLength(rawLength, minLength) {
    if (rawLength === null) {
      throw new Error(
        '"--length" (-l) requires an integer. Example: gen -l 16'
      );
    }
    if (typeof rawLength !== "number" || !Number.isInteger(rawLength)) {
      throw new Error(
        `"--length" must be an integer between ${minLength} and ${MAX_LENGTH}.`
      );
    }
    if (rawLength < minLength) {
      throw new Error(
        `Password length must be at least ${minLength} so each charset subset appears at least once.`
      );
    }
    if (rawLength > MAX_LENGTH) {
      throw new Error(`"--length" cannot exceed ${MAX_LENGTH}.`);
    }
    return rawLength;
  }

  static resolvedField(options) {
    if (typeof options.field === "string") {
      let t = options.field.trim();
      if (!t.length) {
        throw new Error('If you pass "--field (-f)", it must be a non-empty name.');
      }
      return t;
    }
    return DEFAULT_FIELD;
  }

  /** Save like Touch (create) / Totp+Paste (YAML merge or replace plain text). */
  async persistPassword(options, pwd) {
    let fieldName = Gen.resolvedField(options);
    this.checkPath(options);
    let currentIndex = this.internalFs.treeIndex;
    let data = await this.internalFs.getTreeIndexAndPath(options.path);
    if (currentIndex !== data.index) {
      await this.internalFs.mountTree(data.index, true);
    }
    options.path = data.path;
    let tree = data.tree;
    let p = tree.getNormalizedPath(options.path);
    let isYamlPath = isYaml(p);

    let node;
    try {
      node = tree.root.getChildFromPath(p);
    } catch (e) {
      node = null;
    }

    if (!node) {
      let sanitizedPath = Entry.sanitizePath(data.path);
      if (sanitizedPath !== data.path) {
        throw new Error("A filename cannot contain \\/><|:&?*^$ chars.");
      }
      if (!isYamlPath && options.field !== undefined) {
        throw new Error(
          'The "--field (-f)" option applies only to .yml / .yaml card files.'
        );
      }
      let content;
      if (isYamlPath) {
        content = yamlStringify({ [fieldName]: pwd });
      } else {
        content = pwd;
      }
      await this.internalFs.make({
        path: options.path,
        type: config.types.TEXT,
        content,
      });
      this.Logger.grey(`New file "${p}" created with generated password.`);
      return;
    }

    if (!Node.isFile(node)) {
      throw new Error("Cannot write a password to a folder");
    }

    let cat = this.prompt.commands.cat;
    let catEntry = (await cat.cat({ path: p, unformatted: true }))[0];
    if (!Node.isText(catEntry)) {
      throw new Error("You can generate into text files only");
    }

    if (isYamlPath) {
      let parsed;
      if (catEntry.content === undefined) {
        parsed = {};
      } else {
        try {
          parsed = yamlParse(catEntry.content);
        } catch (e) {
          throw new Error("The yml is malformed");
        }
      }
      parsed[fieldName] = pwd;
      let fileEntry = node.getEntry();
      fileEntry.set("content", yamlStringify(parsed));
      await this.internalFs.tree.update(node, fileEntry);
      this.Logger.grey(
        `Card "${node.getPath()}" updated (field "${fieldName}").`
      );
    } else {
      if (options.field !== undefined) {
        throw new Error(
          'The "--field (-f)" option applies only to .yml / .yaml card files.'
        );
      }
      let fileEntry = node.getEntry();
      fileEntry.set("content", pwd);
      await this.internalFs.tree.update(node, fileEntry);
      this.Logger.grey(
        `File "${node.getPath()}" updated with generated password.`
      );
    }
  }

  static _pickChar(pool) {
    let i = crypto.randomInt(0, pool.length);
    return pool[i];
  }

  static _shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      let j = crypto.randomInt(0, i + 1);
      let t = items[i];
      items[i] = items[j];
      items[j] = t;
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      if (options.set === null) {
        throw new Error(
          'Missing value for "--set" (-s). Example: gen -s aA1#'
        );
      }

      let charsetKeys =
        options.set !== undefined
          ? Gen.parseSetSpec(options.set)
          : DEFAULT_SET_KEYS;
      let minLength = charsetKeys.length;

      let length;
      if (options.length !== undefined) {
        length = Gen.resolveChosenLength(options.length, minLength);
      } else {
        length = Math.max(DEFAULT_LENGTH, minLength);
      }

      let pwd = Gen.generatePassword(length, charsetKeys);

      if (options.path) {
        this.prompt.setLastPath(options.path);
        const proceed = await this.checkGitConflictsBeforeOperation();
        if (!proceed) {
          await this.prompt.run();
          return;
        }
      }

      this.Logger.reset(pwd);

      if (options.path) {
        await this.persistPassword(options, pwd);
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Gen;
