const { authenticator } = require("otplib");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const { execSync } = require("child_process");
const {
  isYaml,
  yamlParse,
  yamlStringify,
  execAsync,
  TRUE,
} = require("@secrez/utils");
const { Node } = require("@secrez/fs");
const QrCode = require("qrcode-reader");
const Jimp = require("jimp");

class Totp extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.totp = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.totp = true;
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
        name: "duration",
        alias: "d",
        type: Number,
      },
      {
        name: "no-beep",
        type: Boolean,
      },
      {
        name: "from-clipboard",
        alias: "c",
        type: Boolean,
      },
      {
        name: "from-image",
        alias: "i",
        type: String,
      },
      {
        name: "set",
        alias: "s",
        type: String,
      },
      {
        name: "force",
        type: Boolean,
      },
      {
        name: "test",
        type: String,
      },
    ];
    this.defaults = {
      duration: 8,
    };
  }

  help() {
    return {
      description: ["Generate a TOTP code if a totp field exists in the card."],
      examples: [
        [
          "totp coinbase.yml",
          "prints a totp code and copies it to the clipboard for 5 seconds if not in a headless shell",
        ],
        [
          'totp coinbase.yml -s "9syh 34rd ge6s hey3 u874"',
          "set up a totp code, if not set yet",
        ],
        [
          "totp github.com.yml -s USyehAA35TSE --force",
          "update an existing totp code",
        ],
        ["totp coinbase.yml -d 2", "keeps it in the clipboard for 2 seconds"],
        [
          "totp github.yml --from-clipboard",
          'get a secret from a qr code copied in the clipboard and add a field "totp" with the secret in "github.yml"',
        ],
        [
          "totp github.yml --from-image qrcode.png",
          "get a secret from the image",
        ],
        ['totp --test "IHSG UY6T WTGS"', "tests a secret"],
      ],
    };
  }

  async isImagePasteSupported() {
    /* istanbul ignore if  */
    if (TRUE()) {
      let result;
      switch (process.platform) {
        case "darwin":
          result = await execAsync("which", __dirname, ["pngpaste"]);
          if (!result.message || result.code === 1) {
            throw new Error(
              'pngpaste is required. Run "brew install pngpaste" in another terminal to install it'
            );
          }
          break;
        case "win32":
          throw new Error("Operation not supported on Windows");
        default:
          result = await execAsync("which", __dirname, ["xclip"]);
          if (!result.message || result.code === 1) {
            throw new Error(
              'xclip is required. On Debian/Ubuntu you can install it with "sudo apt install xclip"'
            );
          }
      }
    }
  }

  async readFromClipboard(options) {
    /* istanbul ignore if  */
    if (TRUE()) {
      await this.isImagePasteSupported();
      let p = path.resolve(this.secrez.config.tmpPath, "image.png");
      let result;
      switch (process.platform) {
        case "darwin":
          result = await execAsync("pngpaste", __dirname, [p]);
          if (result.error) {
            if (/target image\/png not available/.test(result.error)) {
              throw new Error("The clipboard does not contain an image");
            }
            throw new Error(result.error);
          }
          break;
        default:
          try {
            result = execSync(
              `xclip -selection clipboard -t image/png -o > ${p}`
            ).toString();
          } catch (e) {
            throw new Error("Wrong content in the clipboard");
          }
      }
      return p;
    }
  }

  async readFromImage(options) {
    let p = this.externalFs.getNormalizedPath(options.fromImage);
    const buffer = await fs.readFile(p);
    return new Promise((resolve, reject) => {
      Jimp.read(buffer, (err, image) => {
        if (err) {
          reject(err.message);
        }
        const qr = new QrCode();
        qr.callback = (err, value) => {
          /* istanbul ignore if  */
          if (err) {
            reject(err.message);
          }
          resolve(value.result);
        };
        try {
          qr.decode(image.bitmap);
        } catch (e) {
          reject(e.message);
        }
      });
    });
  }

  async totp(options = {}) {
    let secret = options.set;
    let originalPath = options.path;
    if (options.test) {
      const token = authenticator.generate(options.test.replace(/\s/g, ""));
      return token;
    }
    if (options.fromImage || options.fromClipboard) {
      /* istanbul ignore if  */
      if (options.fromClipboard) {
        options.fromImage = await this.readFromClipboard(options);
      }
      try {
        let result = await this.readFromImage(options);
        secret = result.split("secret=")[1].split("&")[0];
      } catch (e) {
        throw new Error("The file does not look like a valid 2FA QR code");
      }
    }
    let err = "The file is not a card with a totp field";
    let currentIndex = this.internalFs.treeIndex;
    let data = await this.internalFs.getTreeIndexAndPath(options.path);
    /* istanbul ignore if  */
    if (currentIndex !== data.index) {
      await this.internalFs.mountTree(data.index, true);
    }
    if (secret && !originalPath) {
      return `The secret in the QR Code is "${secret}"`;
    }
    options.path = data.path;
    let tree = data.tree;
    let p = tree.getNormalizedPath(options.path);
    let node = tree.root.getChildFromPath(p);
    if (Node.isFile(node)) {
      let entry = (
        await this.prompt.commands.cat.cat({
          path: p,
          unformatted: true,
        })
      )[0];
      if (Node.isText(entry)) {
        let { content } = entry;
        if (isYaml(p) && !options.allFile) {
          let parsed;
          if (content === undefined) {
            parsed = {};
          } else {
            try {
              parsed = yamlParse(content);
            } catch (e) {
              throw new Error("The yml is malformed");
            }
          }
          if (secret) {
            if (parsed.totp && !options.force) {
              throw new Error(
                'A totp already set. Use the "--force" option to override it'
              );
            }
            parsed.totp = secret;
            let entry = node.getEntry();
            entry.set("content", yamlStringify(parsed));
            await this.internalFs.tree.update(node, entry);
            return [
              "A totp field has been successfully created.",
              `Try it, running "totp ${node.getPath()}"`,
            ].join("\n");
          } else {
            let totp = parsed.totp;
            if (totp) {
              totp = totp.replace(/\s/g, "");
              const token = authenticator.generate(totp);
              if (this.isMacGuiSession()) {
                this.prompt.commands.copy.copy({
                  thisString: token,
                  duration: [options.duration || this.defaults.duration],
                  noBeep: options.noBeep,
                });
              }
              return token;
            }
          }
        }
      }
    }
    throw new Error(err);
  }

  isMacGuiSession() {
    const platform = os.platform(); // 'darwin', 'linux', 'win32', etc.

    if (platform === "darwin") {
      // macOS only
      try {
        execSync("echo test | pbcopy", { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }

    // On Linux and Windows, pbcopy doesn't exist, so we assume false
    return false;
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);

      // Check for git conflicts before setting TOTP secrets
      if (options.set || options.fromClipboard || options.fromImage) {
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          await this.prompt.run();
          return;
        }
      }

      // Track the last path used if a path was specified
      if (options.path) {
        this.prompt.setLastPath(options.path);
      }

      let token = await this.totp(options);
      if (options.fromImage || options.fromClipboard) {
        this.Logger.grey(token);
      } else {
        this.Logger.grey("TOTP token: " + this.chalk.bold(token));
        if (!options.test && this.isMacGuiSession()) {
          this.Logger.grey(
            `Copied to the clipboard. It will stay in it for ${
              options.duration || this.defaults.duration
            } seconds`
          );
        }
      }
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Totp;
