const path = require("path");
const fs = require("fs-extra");
const utils = require("@secrez/utils");

const SSH_USER_RE = /^[a-zA-Z0-9._-]+$/;
const SSH_HOST_RE = /^[a-zA-Z0-9.-]+$/;

class Ssh extends require("../Command") {
  setHelpAndCompletion() {
    this.cliConfig.completion.ssh = {
      _func: this.selfCompletion(this),
      _self: this,
    };
    this.cliConfig.completion.help.ssh = true;
    this.optionDefinitions = [
      {
        name: "help",
        alias: "h",
        type: Boolean,
      },
      {
        name: "remote-host",
        alias: "r",
        defaultOption: true,
        type: String,
      },
      {
        name: "identity",
        completionType: "file",
        alias: "i",
        type: String,
      },
      {
        name: "user",
        alias: "u",
        type: String,
      },
      {
        name: "delete-after",
        alias: "d",
        type: Number,
      },
      {
        name: "ignore-host-key-check",
        type: Boolean,
      },
    ];
  }

  help() {
    return {
      description: [
        "Opens a new tab and run ssh to connect to a remote server via SSH",
        "Notice that the SSH key is temporarily copied to ~/.ssh and removed after few seconds seconds.",
      ],
      examples: [
        [
          "ssh example.com -i id_ed25519 -u joe",
          'connects using the private key "main:/.ssh/id_ed25519"',
        ],
        [
          "ssh example.com -i keys:/id_rsa",
          'connects as root using the private key "id_rsa" in the root of the "keys" dataset',
        ],
        [
          "ssh example.com -i keys:/id_rsa_no -d 2",
          "deletes the private key from the temporary folder after 2 seconds. The standard is 10 seconds to give you the time to type the password, but if the private key is passwordless you should reduce the time.",
        ],
      ],
    };
  }

  validateSshUser(user) {
    if (!SSH_USER_RE.test(user)) {
      throw new Error(`Invalid SSH user "${user}"`);
    }
  }

  validateSshHost(host) {
    if (!SSH_HOST_RE.test(host)) {
      throw new Error(`Invalid remote host "${host}"`);
    }
  }

  async ssh(options = {}) {
    if (!options.remoteHost) {
      throw new Error("A remote host is required");
    }
    const user = options.user || "root";
    this.validateSshUser(user);
    this.validateSshHost(options.remoteHost);

    let result = await utils.execAsync("which", __dirname, ["ttab"]);
    if (!result.message || result.code === 1) {
      throw new Error(
        'On MacOS ttab is required. Run "npm i -g ttab" in another terminal to install it'
      );
    }
    if (!options.identity) {
      throw new Error("A path to the identity key is required");
    }
    let key = (
      await this.prompt.commands.cat.cat({
        path: options.identity,
        unformatted: true,
      })
    )[0].content;
    let sshPath = path.join(this.secrez.config.tmpPath, ".ssh");
    if (!(await fs.pathExists(sshPath))) {
      await fs.ensureDir(sshPath);
      await utils.execAsync("chmod", this.secrez.config.tmpPath, [
        "700",
        ".ssh",
      ]);
    }
    let keyName = `id_${Math.random().toString().substring(2)}`;
    let keyPath = path.join(sshPath, keyName);
    await fs.writeFile(keyPath, key);
    await utils.execAsync("chmod", sshPath, ["600", keyName]);

    const args = ["ssh"];
    if (options.ignoreHostKeyCheck) {
      args.push("-oStrictHostKeyChecking=no");
    }
    args.push("-i", keyPath, `${user}@${options.remoteHost}`);

    result = await utils.execAsync("ttab", __dirname, args);
    if (result.code !== 0) {
      throw new Error(result.error || "Failed to open SSH tab");
    }

    setTimeout(() => {
      fs.unlink(keyPath);
    }, 10000);
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp();
    }
    try {
      this.validate(options);
      let result = await this.ssh(options);
      this.Logger.reset(result);
    } catch (e) {
      this.Logger.red(e.message);
    }
    await this.prompt.run();
  }
}

module.exports = Ssh;
