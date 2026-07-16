const path = require("path");
const fs = require("fs");

function decolorize(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

let target = process.argv[2];

if (!fs.existsSync(path.resolve(__dirname, "../packages", target))) {
  console.error(`Wrong target: ${target}`);
  process.exit(1);
}

let coverage = fs
  .readFileSync(
    path.resolve(__dirname, "../packages", target, "coverage.report"),
    "utf8"
  )
  .split("\n");

let result = [];
for (let row of coverage) {
  row = decolorize(row);

  if (/ {2}\d+ failing/.test(row)) {
    process.exit(1);
  }

  if (result[0]) {
    if (result[2] && !row) {
      break;
    }
    result.push(row);
  }
  if (/ {2}\d+ passing/.test(row)) {
    result.push(row);
  }
}

let text = "## Test coverage";

coverage = result.join("\n");

let p = path.resolve(__dirname, "../packages", target, "README.md");

let README = fs.readFileSync(p, "utf8").split(text);

let coverageSection = README[1].split("```");

coverageSection[1] = `\n${coverage}\n`;

let readme = `${README[0]}${text}${coverageSection.join("```")}`;

fs.writeFileSync(p, readme);
