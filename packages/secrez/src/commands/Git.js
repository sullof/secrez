const chalk = require("chalk");
const { yamlStringify, execAsync } = require("@secrez/utils");

class Git extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.git = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.git = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "status",
        alias: "s",
        type: Boolean,
      },
      {
        name: "push",
        alias: "p",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: [
        "Check a git repository status or push current changes and update the fingerprint.",
      ],
      examples: [
        ["git -s", "Check the git repository status"],
        [
          "git -p",
          "Stage, commit (if needed), push changes, and update the fingerprint",
        ],
      ],
    };
  }

  async git(options = {}) {
    const isGit = await this.internalFs.gitConflictChecker.isGitRepository();
    if (isGit) {
      if (options.status) {
        let status = await this.internalFs.gitConflictChecker.getGitStatus();
        let warning =
          await this.internalFs.gitConflictChecker.getWarningMessage(status);
        if (warning) {
          return chalk.yellow(warning);
        } else return "No remote changes found.";
      }
      if (options.push) {
        const containerPath = this.secrez.config.container;
        // Get current status to know what to do
        const status = await this.internalFs.gitConflictChecker.getGitStatus();
        if (status && status.error) {
          return chalk.red(`Git status error: ${status.error}`);
        }

        // No changes and not ahead: nothing to push
        if ((status?.uncommitted || 0) === 0 && (status?.ahead || 0) === 0) {
          return "No changes in the repository";
        }

        // If there are uncommitted changes, stage and commit
        if (status && status.uncommitted > 0) {
          const addRes = await execAsync("git", containerPath, ["add", "-A"]);
          if (addRes && addRes.error) {
            return chalk.red(`git add failed: ${addRes.error}`);
          }
          const commitRes = await execAsync("git", containerPath, [
            "commit",
            "-m",
            "Secrez: save changes",
          ]);
          if (commitRes && commitRes.error) {
            return chalk.red(`git commit failed: ${commitRes.error}`);
          }
        }

        // Try to push (even if there were no new commits but local might be ahead)
        const pushRes = await execAsync("git", containerPath, ["push"]);
        if (pushRes && pushRes.error) {
          return chalk.red(`git push failed: ${pushRes.error}`);
        }

        // Update the initial fingerprint so Secrez won't block further operations in this session
        await this.internalFs.gitConflictChecker.captureInitialState();

        return "Pushed successfully. Fingerprint updated.";
      }
    } else {
      return "Not a git repository";
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      // if the user didn't pass any option, we default to options.status
      if (!Object.keys(options).length) {
        options.status = true;
      }
      this.validate(options);
      let result = await this.git(options);
      this.Logger.reset(result);
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Git;
