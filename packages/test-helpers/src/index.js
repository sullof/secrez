const chai = require("chai");
const assert = chai.assert;
const chalk = require("chalk");
const _ = require("lodash");
const path = require("path");
const fs = require("fs-extra");
const stdout = require("test-console").stdout;
const superagent = require("superagent");
const { execAsync, decolorize, setPayloadAndSignIt } = require("./lib/utils0");
const config = require("./lib/coreConfig");
const Entry = require("./lib/Entry0");
const Crypto = require("./lib/Crypto0");
const Node = require("./lib/Node0");
const gitTestRemote = require("./lib/gitTestRemote");
const clipboardTest = require("./lib/clipboardTest");
const fileCipherLegacy = require("./lib/fileCipherLegacy");
const https = require("https");

const helpers = {
  startHttpsServer(key, cert) {
    const options = {
      key,
      cert,
    };
    const server = https
      .createServer(options, (req, res) => {
        res.writeHead(200);
        res.end("hello world");
      })
      .listen(4435);
    return server;
  },

  verifyTlsConnection(key, cert, ca) {
    const options = {
      hostname: "localhost",
      port: 4435,
      path: "/",
      method: "GET",
      ca,
    };
    return new Promise((resolve) => {
      const req = https.request(options, function (res) {
        res.on("data", function (data) {
          resolve(data);
        });
      });
      req.end();
    });
  },

  async sendMessage(message, publicKey1, secrez, server) {
    let encryptedMessage = secrez.encryptSharedData(message, publicKey1);
    const { payload, signature } = setPayloadAndSignIt(secrez, {
      message: encryptedMessage,
    });

    const params = {
      payload,
      signature,
    };

    return superagent
      .post(`${server.localhost}/`)
      .set("Accept", "application/json")
      .query({ cc: 44 })
      .send(params)
      .ca(await server.tls.getCa());
  },

  jsonEqual(j, k) {
    if (j.id !== k.id) return false;
    if (j.v.length !== k.v.length) return false;
    if (j.v) {
      j.v.sort();
      k.v.sort();
      for (let i = 0; i < j.v.length; i++) {
        if (j.v[i] !== k.v[i]) return false;
      }
    }
    if ((j.c || k.c) && j.c.length !== k.c.length) return false;
    if (j.c) {
      const s = (a, b) => {
        let A = a.v.sort()[0];
        let B = b.v.sort()[0];
        return A > B ? 1 : A < B ? -1 : 0;
      };
      j.c.sort(s);
      k.c.sort(s);
      for (let i = 0; i < j.c.length; i++) {
        if (!helpers.jsonEqual(j.c[i], k.c[i])) return false;
      }
    }
    return true;
  },

  decolorize(str, inspect) {
    if (inspect) {
      console.info(inspect.output.map((e) => helpers.decolorize(e)));
    } else {
      return decolorize(str);
    }
  },

  assertConsole(inspect, message, includes) {
    let output = inspect.output.map((e) => helpers.decolorize(e));
    let result = [];
    for (let o of output) {
      o = o.split("\n");
      for (let i of o) {
        if (i) {
          result.push(_.trim(i));
        }
      }
    }
    if (!Array.isArray(message)) {
      message = [message];
    }
    message = message.map((e) => helpers.decolorize(e));
    for (let i = 0; i < message.length; i++) {
      if (includes) {
        assert.isTrue(RegExp(message[i]).test(result[i]));
      } else {
        assert.equal(result[i], message[i]);
      }
    }
    return output;
  },

  async noPrint(func) {
    let inspect = stdout.inspect();
    let ret = await func;
    inspect.restore();
    return ret;
  },

  async copyImageToClipboard(image) {
    let result;
    let p;
    switch (process.platform) {
      case "darwin":
        p = path.resolve(__dirname, "os/build/impbcopy");
        if (!(await fs.pathExists(p))) {
          throw new Error(
            'Please build the helpers, running "npm run build-helpers'
          );
        }
        result = await execAsync(p, __dirname, [image]);
        if (result.error) {
          throw new Error(result.error);
        }

        break;
      case "win32":
        throw new Error("Operation not supported on Windows");
      default:
        result = await execAsync("which", __dirname, ["xclip"]);
        if (result.code === 1) {
          throw new Error(
            'xclip is required. On Debian/Ubuntu you can install it with "sudo apt install xclip"'
          );
        }
        result = await execAsync("xclip", __dirname, [
          "-selection",
          " clipboard",
          "-t",
          "image/png",
          "-i",
          image,
        ]);
        if (result.error) {
          throw new Error(result.error);
        }
    }
  },

  // async getSecrezInstance() {
  //   const Secrez = require('@secrez/core').Secrez(Math.random())
  //   let root = path.resolve(__dirname, '../tmp/test/secrez' + Math.random())
  //   await fs.emptyDir(root)
  //   let secrez = new Secrez()
  //   await secrez.init(root)
  //   await secrez.signup('password' + Math.random(), 10)
  //   return secrez
  // },

  jlog(...x) {
    for (let i = 0; i < x.length; i++) {
      // eslint-disable-next-line no-console
      console.log(
        chalk.blue(
          typeof x[i] === "object" ? JSON.stringify(x[i], null, 2) : x[i]
        )
      );
    }
  },

  initRandomNode(type, secrez, getEntry, name, content) {
    let entry = new Entry({
      id: Crypto.getRandomId(),
      name: name || Crypto.getRandomBase58String(16),
      type,
      preserveContent: true,
    });
    if (content) {
      entry.content = content;
    }
    entry = secrez.encryptEntry(entry);
    if (getEntry) {
      return [entry, new Node(entry)];
    }
    return new Node(entry);
  },

  initRandomEntry(type) {
    return new Entry({
      id: Crypto.getRandomId(),
      name: Crypto.getRandomBase58String(16),
      type,
      preserveContent: true,
    });
  },

  setNewNodeVersion(entry, node, secrez) {
    entry.set({
      id: node.id,
      type: node.type,
      preserveContent: true,
    });
    entry = secrez.encryptEntry(entry);
    return entry;
  },

  initARootNode() {
    let root = new Node(
      new Entry({
        type: config.types.ROOT,
      })
    );
    return root;
  },

  sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
  },

  async assertAsyncThrow(func, expectedError, expectedErrorContains) {
    let errMsg;
    try {
      await func;
    } catch (e) {
      if (e.message) errMsg = e.message;
      else errMsg = e;
      if (expectedError) assert.equal(errMsg, expectedError);
      else if (expectedErrorContains)
        assert.notEqual(errMsg.indexOf(expectedErrorContains), -1);
      else assert.isTrue(true);
    }
    if (!errMsg) assert.isTrue(false);
  },

  async assertThrow(func, expectedError, expectedErrorContains) {
    let errMsg;
    try {
      func();
    } catch (e) {
      if (e.message) errMsg = e.message;
      else errMsg = e;
      if (expectedError) assert.equal(errMsg, expectedError);
      else if (expectedErrorContains)
        assert.notEqual(errMsg.indexOf(expectedErrorContains), -1);
      else assert.isTrue(true);
    }
    if (!errMsg) assert.isTrue(false);
  },

  ...gitTestRemote,
  ...clipboardTest,
  ...fileCipherLegacy,
};

module.exports = helpers;
