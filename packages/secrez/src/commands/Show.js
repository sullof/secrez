const QRCode = require("qrcode");
const { yamlParse, isYaml } = require("@secrez/utils");
const { Node } = require("@secrez/fs");
const _ = require("lodash");

class Show extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.show = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.show = true;
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
        name: "version",
        alias: "v",
        type: Boolean,
      },
      {
        name: "qr-code",
        alias: "q",
        type: Boolean,
      },
      {
        name: "field",
        alias: "f",
        type: String,
      },
    ];
  }

  help() {
    return {
      description: ["Show a card field as a QR code."],
      examples: [
        [
          "show -q wallet.yml -f password",
          "shows the field 'password' of the card 'wallet.yml' as a QR code",
        ],
        [
          "show wallet.yml -f password",
          "shows the field 'password' of the card 'wallet.yml'",
        ],
        [
          "show ethKeys.yaml -v 8uW3",
          "asks you to select a field from the version 8uW3 of the file",
        ],
      ],
    };
  }

  async generateQrCode(content) {
    return new Promise((resolve, reject) => {
      QRCode.toString(content, { type: "terminal" }, (err, qrcode) => {
        if (err) reject(err);
        else resolve(qrcode);
      });
    });
  }

  async show(options) {
    let cat = this.prompt.commands.cat;
    let currentIndex = this.internalFs.treeIndex;
    let data = await this.internalFs.getTreeIndexAndPath(options.path);
    /* istanbul ignore if  */
    if (currentIndex !== data.index) {
      await this.internalFs.mountTree(data.index, true);
    }
    options.path = data.path;
    let tree = data.tree;
    let p = tree.getNormalizedPath(options.path);
    let file = tree.root.getChildFromPath(p);
    if (Node.isFile(file)) {
      let entry = (
        await cat.cat({
          path: p,
          version: options.version ? [options.version] : undefined,
          unformatted: true,
        })
      )[0];
      if (Node.isText(entry)) {
        let { name, content } = entry;
        if (isYaml(p)) {
          let parsed;
          try {
            parsed = yamlParse(content);
          } catch (e) {
            throw new Error("The yml is malformed.");
          }
          if (options.field) {
            if (parsed[options.field]) {
              content = parsed[options.field];
            } else {
              throw new Error(`Field ${options.field} not found`);
            }
          } else {
            let field = await this.useInput({
              type: "list",
              message: "Which field do you want to show?",
              choices: Object.keys(parsed),
            });
            content = parsed[field];
          }
          if (options.qrCode) {
            return this.generateQrCode(content);
          } else {
            return content;
          }
        }
      } else {
        throw new Error("File is not a card.");
      }
    } else {
      throw new Error("Cannot show a folder");
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
      const content = await this.show(options);
      if (content) {
        this.Logger.reset(content);
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Show;
