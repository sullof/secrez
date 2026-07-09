"use strict";

const { StringDecoder } = require("string_decoder");

// Adapted from prompt-skeleton / keypress (MIT). See MemoryEditor.js for attribution.

const metaKeyCodeRe = /^(?:\x1b)([a-zA-Z0-9])$/;
const functionKeyCodeRe =
  /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/;

function parseKey(s, enc) {
  let ch;
  let parts;
  const key = {
    name: undefined,
    ctrl: false,
    meta: false,
    shift: false,
    sequence: s,
  };

  if (Buffer.isBuffer(s)) {
    if (s[0] > 127 && s[1] === undefined) {
      s[0] -= 128;
      s = "\x1b" + s.toString(enc || "utf-8");
    } else {
      s = s.toString(enc || "utf-8");
    }
  }

  if (s === "\r") {
    key.name = "return";
  } else if (s === "\n") {
    key.name = "enter";
  } else if (
    s === "\t" ||
    s === "\b" ||
    s === "\x7f" ||
    s === "\x1b\x7f" ||
    s === "\x1b\b"
  ) {
    if (s === "\t") {
      key.name = "tab";
    } else {
      key.name = "backspace";
      key.meta = s.charAt(0) === "\x1b";
    }
  } else if (s === "\x1b" || s === "\x1b\x1b") {
    key.name = "escape";
    key.meta = s.length === 2;
  } else if (s === " " || s === "\x1b ") {
    key.name = "space";
    key.meta = s.length === 2;
  } else if (s <= "\x1a") {
    key.name = String.fromCharCode(s.charCodeAt(0) + "a".charCodeAt(0) - 1);
    key.ctrl = true;
  } else if (s.length === 1 && s >= "a" && s <= "z") {
    key.name = s;
  } else if (s.length === 1 && s >= "A" && s <= "Z") {
    key.name = s.toLowerCase();
    key.shift = true;
  } else if ((parts = metaKeyCodeRe.exec(s))) {
    key.name = parts[1].toLowerCase();
    key.meta = true;
    key.shift = /^[A-Z]$/.test(parts[1]);
  } else if ((parts = functionKeyCodeRe.exec(s))) {
    const code =
      (parts[1] || "") +
      (parts[2] || "") +
      (parts[4] || "") +
      (parts[6] || "");
    const modifier = (parts[3] || parts[5] || 1) - 1;
    key.ctrl = !!(modifier & 4);
    key.meta = !!(modifier & 10);
    key.shift = !!(modifier & 1);
    key.code = code;
    switch (code) {
      case "[A":
      case "OA":
        key.name = "up";
        break;
      case "[B":
      case "OB":
        key.name = "down";
        break;
      case "[C":
      case "OC":
        key.name = "right";
        break;
      case "[D":
      case "OD":
        key.name = "left";
        break;
      default:
        key.name = "undefined";
        break;
    }
  } else if (s.length > 1 && s[0] !== "\x1b") {
    return Array.prototype.map.call(s, (c) => parseKey(c, enc));
  }

  if (s.length === 1) {
    ch = s;
  }
  key.raw = ch || s;
  return key;
}

function onKeypress(stream, cb) {
  const decoder = new StringDecoder("utf8");
  const onData = (data) => {
    const parsed = parseKey(decoder.write(data), stream.encoding);
    if (Array.isArray(parsed)) {
      parsed.forEach((c) => cb(c));
    } else {
      cb(parsed);
    }
  };

  const oldRawMode = stream.isRaw;
  stream.setRawMode(true);
  stream.on("data", onData);
  stream.resume();

  return () => {
    stream.setRawMode(oldRawMode);
    stream.pause();
    stream.removeListener("data", onData);
  };
}

module.exports = onKeypress;
