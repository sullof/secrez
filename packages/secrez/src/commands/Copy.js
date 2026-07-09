const path = require("path");
const os = require("os");
const clipboardy = require("clipboardy");
const { isYaml, yamlParse, TRUE, sleep, playMp3 } = require("@secrez/utils");
const { Node } = require("@secrez/fs");
const { execSync } = require("child_process");

let clipboardQueue = Promise.resolve();

function runClipboardTask(task) {
  const next = clipboardQueue.then(task, task);
  clipboardQueue = next.catch(() => {});
  return next;
}

async function drainClipboardQueue() {
  await clipboardQueue;
}

class Copy extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.copy = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.copy = true;
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
        multiple: true,
        type: Number,
      },
      {
        name: "json",
        alias: "j",
        type: Boolean,
      },
      {
        name: "field",
        alias: "f",
        type: String,
        multiple: true,
      },
      {
        name: "version",
        alias: "v",
        type: String,
      },
      {
        name: "all-file",
        alias: "a",
        type: Boolean,
      },
      {
        name: "no-beep",
        type: Boolean,
      },
      {
        name: "this-string",
        type: String,
      },
      {
        name: "wait",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: [
        "Copy a text file to the clipboard. It won't work in headless shells.",
      ],
      examples: [
        [
          "copy ethKeys",
          "copies to the clipboard for 10 seconds (the default)",
        ],
        ["copy google.yml -j", "copies the google card as a JSON"],
        ["copy -ap google.yml", "copies the google card as is"],
        ["copy google.yml", "it will ask to chose the field to copy"],
        [
          "copy -f user --wait -p google.yml",
          "it copies the user from google.yml and wait for the full duration",
        ],
        ["copy myKey -v UY5d", "copies version UY5d of myKey"],
        [
          "copy google.yml -d 10 -f password",
          "copies the password in the google card and keeps it in the clipboard for 10 seconds; default is 5 seconds",
        ],
        [
          "copy google.yml -f email password -d 3 2",
          "copies email and keeps it in the clipboard for 3 seconds, after copies password and keeps it for 2 seconds; a bip will sound when a new data is copied",
        ],
        [
          "copy google.yml -f user email password -d 3",
          "copies user, email and password, one after the other, with an interval of 3 seconds",
        ],
        [
          "copy google.yml -f email password --no-beep",
          "copies without emitting a beep at clipboard change",
        ],
      ],
    };
  }

  async copy(options = {}) {
    if (!this.counter) {
      this.counter = 0;
    }
    if (options.thisString) {
      this.counter++;
      if (options.wait) {
        await this.write([options.thisString], options, 0 + this.counter);
      } else {
        this.write([options.thisString], options, 0 + this.counter);
      }
      return `"${options.thisString}"`;
    }
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
        if (isYaml(p) && !options.allFile) {
          let parsed;
          try {
            parsed = yamlParse(content);
          } catch (e) {
            throw new Error(
              "The yml is malformed. To copy the entire content, do not use the options -j or -f"
            );
          }
          if (options.json) {
            content = JSON.stringify(parsed, null, 2);
          } else if (options.field) {
            content = [];
            for (let f of options.field) {
              if (parsed[f]) {
                content.push(parsed[f].toString());
              } else {
                throw new Error(
                  `Field "${f}" not found in "${path.basename(p)}"`
                );
              }
            }
          } else {
            /* istanbul ignore if  */
            if (TRUE()) {
              options.choices = Object.keys(parsed);
              options.message = "Select the field to copy";
              options.field = await this.useSelect(options);
              if (!options.field) {
                throw new Error("Command canceled");
              } else {
                content = parsed[options.field];
              }
            }
          }
        }
        if (!Array.isArray(content)) {
          content = [content];
        }
        this.counter++;
        if (options.wait) {
          await this.write(content, options, 0 + this.counter);
        } else {
          this.write(content, options, 0 + this.counter);
        }
        return name;
      } else {
        throw new Error("You can copy to clipboard only text files.");
      }
    } else {
      throw new Error("Cannot copy a folder");
    }
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

  async write(content, options, counter) {
    let duration = options.duration
      ? options.duration.map((e) => 1000 * e)
      : [5000];
    if (!duration[1]) {
      duration[1] = duration[0];
    }
    for (let i = 0; i < content.length; i++) {
      if (this.counter === counter) {
        let wait = i ? duration[1] : duration[0];
        await this.writeAndWait(content[i], wait, counter);
        if (this.counter === counter && !options.noBeep) {
          try {
            await playMp3(path.resolve(__dirname, "../../sounds/ding.mp3"));
          } catch (e) {
            // Ignore the error
          }
        }
      }
    }
  }

  async writeAndWait(content, wait, counter) {
    if (this.isMacGuiSession()) {
      let previousContent = await clipboardy.read();
      if (this.counter === counter) {
        await clipboardy.write(content);
        await sleep(wait);
        if (this.counter === counter && content === (await clipboardy.read())) {
          await clipboardy.write(previousContent);
        }
      }
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    if (!this.isMacGuiSession()) {
      this.Logger.red("Clipboard is not available in this shell");
    } else {
      try {
        /* istanbul ignore if  */
        if (!this.clipboardyVerified) {
          await clipboardy.read();
        }
        this.validate(options);
        let name = await this.copy(options);
        this.Logger.grey("Copied to clipboard:");
        this.Logger.reset(name);
      } catch (e) {
        this.Logger.red(e.message);
      }
    }
    await this.prompt.run();
  }
}

module.exports = Copy;
