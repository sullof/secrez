const { spawn } = require("child_process");

function execShell(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      cwd,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString("utf8");
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(stderr.trim() || stdout.trim() || `Exit code ${code}`)
        );
      }
    });
    child.on("error", reject);
  });
}

class Shell extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.shell = {
      _self: this,
    };
    this.cliConfig.completion.help.shell = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "command",
        alias: "c",
        type: String,
        defaultOption: true,
      },
    ];
  }

  help() {
    return {
      description: ["Execute a shell command in the current disk folder."],
      examples: [
        'shell "ls"',
        ['shell "mv wallet1 wallet2"', "renames an external file"],
        ["shell", "asks to type the command to execute"],
      ],
    };
  }

  async shell(options) {
    let pwd = await this.prompt.commands.lpwd.lpwd();
    if (!options.command) {
      options.command = await this.useInput(
        Object.assign(options, {
          message: "Type the command",
        })
      );
    }
    return execShell(options.command, pwd);
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      this.Logger.reset(await this.shell(options));
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Shell;
