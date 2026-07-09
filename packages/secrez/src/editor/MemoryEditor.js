"use strict";

// In-memory terminal editor vendored from tiny-cli-editor (ISC) and prompt-skeleton.
// https://github.com/derhuerst/tiny-cli-editor

const { PassThrough } = require("stream");
const { EventEmitter } = require("events");
const esc = require("ansi-escapes");
const onKeypress = require("./onKeypress");

const insert = (s, x, c) => s.slice(0, x) + c + s.slice(x);

const EDITOR_STATUS = "Ctrl-d save · Ctrl-c abort";

function terminalRows() {
  return process.stdout.rows || 24;
}

function keyAction(key) {
  if (key.ctrl) {
    if (key.name === "a") return "first";
    if (key.name === "c") return "abort";
    if (key.name === "d") return "abort";
    if (key.name === "e") return "last";
    if (key.name === "g") return "reset";
  }
  if (key.name === "return" || key.name === "enter") return "submit";
  if (key.name === "backspace") return "delete";
  if (key.name === "abort" || key.name === "escape") return "abort";
  if (key.name === "up") return "up";
  if (key.name === "down") return "down";
  if (key.name === "right") return "right";
  if (key.name === "left") return "left";
  return false;
}

const Editor = {
  update() {
    this.value = this.lines.join("\n");
    this.emit();
  },

  reset() {
    this.lines = this.initialLines;
    this.cursorX = 0;
    this.cursorY = 0;
    this.update();
    this.render();
  },

  abort(c) {
    this.done = true;
    this.aborted = !(c.ctrl && c.name === "d");
    this.out.write(esc.clearScreen + esc.cursorTo(0, 0));
    this.close();
  },

  submit() {
    const line = this.lines[this.cursorY];
    this.lines.splice(
      this.cursorY,
      1,
      line.slice(0, this.cursorX),
      line.slice(this.cursorX)
    );
    this.cursorY++;
    this.cursorX = 0;
    this.update();
    this.render();
  },

  up() {
    if (this.cursorY === 0) return;
    this.cursorY--;
    this.cursorX = Math.min(this.cursorX, this.lines[this.cursorY].length);
    this.update();
    this.render();
  },

  down() {
    if (this.cursorY === this.lines.length - 1) return;
    this.cursorY++;
    this.cursorX = Math.min(this.cursorX, this.lines[this.cursorY].length);
    this.update();
    this.render();
  },

  left() {
    if (this.cursorX === 0) {
      if (this.cursorY === 0) return;
      this.cursorY--;
      this.cursorX = this.lines[this.cursorY].length;
      return;
    }
    this.cursorX--;
    this.update();
    this.render();
  },

  right() {
    const line = this.lines[this.cursorY];
    if (this.cursorX === line.length) {
      if (this.cursorY === this.lines.length - 1) return;
      this.cursorY++;
      this.cursorX = 0;
      return;
    }
    this.cursorX++;
    this.update();
    this.render();
  },

  first() {
    this.cursorX = 0;
    this.update();
    this.render();
  },

  last() {
    this.cursorX = this.lines[this.cursorY].length;
    this.update();
    this.render();
  },

  _(c) {
    const { lines, cursorX, cursorY } = this;
    lines[cursorY] = insert(lines[cursorY], cursorX, c);
    this.cursorX++;
    this.update();
    this.render();
  },

  delete() {
    const { lines, cursorX, cursorY } = this;
    const line = lines[cursorY];

    if (cursorX > 0) {
      lines[cursorY] = line.slice(0, cursorX - 1) + line.slice(cursorX);
      this.cursorX--;
    } else if (cursorY > 0) {
      const xFromAbove = this.lines[cursorY - 1].length;
      lines.splice(cursorY - 1, 2, lines[cursorY - 1] + lines[cursorY]);
      this.cursorY--;
      this.cursorX = xFromAbove;
    } else {
      return;
    }

    this.update();
    this.render();
  },

  bell() {
    this.out.write(esc.beep);
  },

  render() {
    if (this.firstRender) {
      this.firstRender = false;
      this.out.write("\n".repeat(terminalRows()));
    }

    const rows = terminalRows();
    const statusRow = Math.max(0, rows - 1);
    const { lines, cursorX, cursorY } = this;
    this.out.write(
      esc.clearScreen +
        lines.join("\n") +
        esc.cursorTo(0, statusRow) +
        "\x1b[2m" +
        EDITOR_STATUS +
        "\x1b[0m" +
        esc.cursorTo(cursorX, cursorY)
    );
  },
};

function createEditor(text) {
  if (typeof text !== "string") {
    throw new Error("Text must be string.");
  }

  const emitter = new EventEmitter();
  const p = Object.assign(Object.create(Editor), {
    lines: [],
    initialLines: [],
    cursorX: 0,
    cursorY: 0,
    firstRender: true,
    done: false,
    aborted: false,
    value: "",
    out: new PassThrough(),
  });

  const lb = /\r?\n/;
  p.initialLines = text.split(lb);
  p.lines = text.split(lb);
  p.out.pipe(process.stdout);

  p.emit = () => {
    emitter.emit("change", {
      value: p.value,
      aborted: !!p.aborted,
    });
  };

  if (typeof p._ !== "function") {
    p._ = () => p.bell();
  }

  let offKeypress;
  const pause = () => {
    if (!offKeypress) return;
    offKeypress();
    offKeypress = null;
  };

  const resume = () => {
    if (offKeypress) return;
    offKeypress = onKeypress(process.stdin, (key) => {
      const action = keyAction(key);
      if (action === false) {
        p._(key.raw);
      } else if (action in p) {
        p[action](key);
      } else {
        p.bell();
      }
    });
  };

  let isClosed = false;
  p.close = () => {
    if (isClosed) return;
    isClosed = true;
    pause();
    p.out.unpipe(process.stdout);
    process.stdout.write(esc.cursorShow);
    if (p.aborted) {
      emitter.emit("abort", p.value);
    } else {
      emitter.emit("submit", p.value);
    }
    emitter.emit("close");
  };

  resume();
  p.update();
  p.render();

  emitter.pause = pause;
  emitter.resume = resume;
  emitter.setText = (nextText) => {
    p.lines = nextText.split(lb);
    if (!p.lines[p.cursorY]) {
      p.cursorY = p.lines.length - 1;
    }
    p.cursorX = Math.min(p.cursorX, p.lines[p.cursorY].length);
    p.update();
    p.render();
  };

  return emitter;
}

function editInMemory(text) {
  return new Promise((resolve) => {
    const editor = createEditor(text);
    const finish = (value) => {
      editor.pause();
      resolve(value);
    };
    editor.on("submit", finish);
    editor.on("abort", () => finish(undefined));
  });
}

module.exports = {
  createEditor,
  editInMemory,
};
