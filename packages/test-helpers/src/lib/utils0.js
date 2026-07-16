const { spawn } = require("child_process");
const _ = require("lodash");

const utils0 = {
  async execAsync(cmd, cwd, params) {
    return new Promise((resolve) => {
      let json = {};
      const child = spawn(cmd, params, {
        cwd,
        shell: true,
      });
      child.stdout.on("data", (data) => {
        json.message = _.trim(Buffer.from(data).toString("utf8"));
      });
      child.stderr.on("data", (data) => {
        json.error = _.trim(Buffer.from(data).toString("utf8"));
      });
      child.on("exit", (code) => {
        json.code = code;
        resolve(json);
      });
    });
  },

  removeNotPrintableChars(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00\x08\x0B\x0C\x0E-\x1F]+/g, "");
  },

  decolorize(str, noTrim) {
    if (!noTrim) {
      str = _.trim(str);
    }
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  },
};

module.exports = utils0;
