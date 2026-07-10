const _ = require("lodash");
const { Entry } = require("@secrez/core");
const { isYaml, yamlParse, yamlStringify } = require("@secrez/utils");

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
        "Edits a file containing a secret using the in-memory editor.",
        "Secrets are never written to a temporary file on disk.",
        "Editor commands:",
        "   Ctrl-c to cancel",
        "   Ctrl-d to save",
        "   Ctrl-k to delete the current line",
      ],
      examples: [
        ["edit ../coins/ether2-pwd", "edits a secret file"],
        [
          "edit gmail.yml -f password",
          "edits only the field password of the yaml file. If the field does not exist, a new field is added",
        ],
        [
          "edit main:/gmail.yml -f password",
          "edits a file using a dataset-qualified path",
        ],
        ["edit damaged.yaml -u", "edits damaged.yaml without parsing it"],
      ],
    };
  }

  async edit(options) {
    let data = await this.internalFs.getTreeIndexAndPath(options.path);
    let file = data.path;
    let tree = data.tree;

    let sanitizedPath = Entry.sanitizePath(file);
    if (sanitizedPath !== file) {
      throw new Error("A filename cannot contain \\/><|:&?*^$ chars.");
    }

    let exists = false;
    let fileData;
    try {
      fileData = await this.prompt.commands.cat.cat(
        { path: options.path },
        true
      );
      exists = true;
    } catch (e) {
      if (options.field) {
        throw new Error("Field can be specified only for existent files");
      }
      fileData = [{ content: "" }];
    }

    let p = tree.getNormalizedPath(file);
    let fields = {};
    if (exists && !options.unformatted && isYaml(p)) {
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
    } else if (!isYaml(p)) {
      delete options.field;
    }
    let content = options.field
      ? fields[options.field] || ""
      : fileData[0].content;
    let newContent = await this.useEditor(Object.assign(options, { content }));

    if (newContent && newContent !== content) {
      if (exists) {
        let node = tree.root.getChildFromPath(p);
        let entry = node.getEntry();
        if (options.field) {
          fields[options.field] = _.trim(newContent);
          entry.set({ content: yamlStringify(fields) });
        } else {
          entry.set({ content: newContent });
        }
        await tree.update(node, entry);
      } else {
        await this.prompt.commands.touch.touch({
          path: options.path,
          content: newContent,
        });
      }
      this.Logger.reset("File saved.");
    } else {
      this.Logger.reset("Changes aborted or file not changed");
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

      const shouldProceed = await this.checkGitConflictsBeforeOperation();
      if (!shouldProceed) {
        return;
      }

      await this.edit(options);
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Edit;
