// Next line is to avoid that npm-check-unused reports it
require("tiny-cli-editor");
//

const _ = require("lodash");
const path = require("path");
const fs = require("fs-extra");
const { Entry } = require("@secrez/core");
const {
  isYaml,
  yamlParse,
  yamlStringify,
  execAsync,
} = require("@secrez/utils");

class Edit extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.edit = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.edit = true;
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
        name: "editor",
        alias: "e",
        type: String,
      },
      {
        name: "internal",
        alias: "i",
        type: Boolean,
      },
      {
        name: "field",
        alias: "f",
        type: String,
      },
      {
        name: "unformatted",
        alias: "u",
        type: Boolean,
        hint: "If a Yaml file, it edits it without parsing the file",
      },
    ];
  }

  help() {
    return {
      description: [
        "Edits a file containing a secret.",
        "If no default editor is installed, you can use the minimalistic internal editor.",
        "It supports only two commands:",
        "" + "   Ctrl-c to cancel",
        "   Ctrl-d to save",
        "WARNING: Do not quit forcely because a temp file can remain on disk, unencrypted. If for any reason you do it, launch Secrez again because at start it empties the temp folder.",
      ],
      examples: [
        ["edit ../coins/ether2-pwd", "uses the OS default editor"],
        ["edit ../bitcoin/seed -i", "uses the minimalistic internal editor"],
        [
          "edit ../bitcoin/seed -e nano",
          "choses the editor, in this case nano",
        ],
        ["edit ../bitcoin/seed -e vim", "uses vim"],
        [
          "edit gmail.yml -f password",
          "edits only the field password of the yaml file. If the field does not exist, a new field is added",
        ],
        ["edit damaged.yaml -u", "edits damaged.yaml without parsing it"],
      ],
    };
  }

  async edit(options) {
    let file = options.path;
    if (/:/.test(file)) {
      // TODO Fix this
      throw new Error(
        "Edit works only on the current dataset. Remove the dataset from the path, please"
      );
    }
    let sanitizedPath = Entry.sanitizePath(options.path);
    if (sanitizedPath !== options.path) {
      throw new Error("A filename cannot contain \\/><|:&?*^$ chars.");
    }
    let exists = false;
    let fileData;
    try {
      fileData = await this.prompt.commands.cat.cat({ path: file }, true);
      exists = true;
    } catch (e) {
      if (options.field) {
        throw new Error("Field can be specified only for existent files");
      }
      fileData = [{ content: "" }];
    }

    let fields = {};
    if (exists && !options.unformatted && isYaml(file)) {
      fields = fileData[0].content ? yamlParse(fileData[0].content) : {};
      if (typeof fields === "object") {
        options.choices = Object.keys(fields);
        if (options.choices.length && !options.field) {
          options.message = "Select the field to edit";
          options.field = await this.useSelect(options);
          if (!options.field) {
            this.Logger.reset("Changes aborted or file not changed");
            return;
          }
        }
      } else {
        delete options.field;
      }
    } else if (!isYaml(file)) {
      delete options.field;
    }
    let content = options.field
      ? fields[options.field] || ""
      : fileData[0].content;
    let newContent = await this.useEditor(Object.assign(options, { content }));

    if (newContent && newContent !== content) {
      if (exists) {
        let node = this.internalFs.tree.workingNode.getChildFromPath(file);
        let entry = node.getEntry();
        if (options.field) {
          fields[options.field] = _.trim(newContent);
          entry.content = yamlStringify(fields);
        } else {
          entry.content = newContent;
        }
        await this.internalFs.tree.update(node, entry);
      } else {
        await this.prompt.commands.touch.touch({
          path: file,
          content: newContent,
        });
      }
      this.Logger.reset("File saved.");
    } else {
      this.Logger.reset("Changes aborted or file not changed");
    }
  }

  getTinyCliEditorBinPath() {
    if (!this.editorBinPath) {
      let bin = path.resolve(
        __dirname,
        "../../node_modules/tiny-cli-editor/bin.js"
      );
      if (!fs.existsSync(bin)) {
        bin = path.resolve(
          __dirname,
          "../../../../node_modules/tiny-cli-editor/bin.js"
        );
      }
      if (!fs.existsSync(bin)) {
        throw new Error("Default editor not found");
      }
      this.editorBinPath = bin;
    }
    return this.editorBinPath;
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    let currentEditor;
    try {
      this.validate(options, {
        path: true,
      });
      
      if (!options.help) {
        // Check for git conflicts before editing files (edit always changes something)
        const shouldProceed = await this.checkGitConflictsBeforeOperation();
        if (!shouldProceed) {
          return;
        }
      }
      currentEditor = process.env.EDITOR;
      if (options.internal) {
        process.env.EDITOR = this.getTinyCliEditorBinPath();
      } else if (options.editor) {
        process.env.EDITOR = options.editor;
      }
      if (!process.env.EDITOR) {
        let result = await execAsync("which", __dirname, ["nano"]);
        if (!result.message || result.code === 1) {
          result = await execAsync("which", __dirname, ["vim"]);
          if (!result.message || result.code === 1) {
            throw new Error(
              'No text editor found. Set up the EDITOR env variable or use the -e option. Type "edit -h" for more options.'
            );
          } else {
            process.env.EDITOR = "vim";
          }
        } else {
          process.env.EDITOR = "nano";
        }
      }
      await this.edit(options);
    } catch (e) {
      this.Logger.red(e.message);
    }
    // eslint-disable-next-line require-atomic-updates
    process.env.EDITOR = currentEditor;
    await this.prompt.run();
  }
}

module.exports = Edit;
