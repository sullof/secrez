const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let changes;
const publishCommands = [];

let gitDiff = execSync("git diff --name-only").toString().split("\n");

if (gitDiff.length > 0 && gitDiff[0]) {
  console.error("The repo is not committed.");
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

function checkIfMustBePublished(dir) {
  const pkg = dir === "secrez" ? "" : "@secrez/";
  console.debug(`Checking  ${pkg}${dir}`);
  const version = require(`../packages/${dir}/package.json`).version;
  const currVersion = execSync(`npm view ${pkg}${dir} | grep latest`)
    .toString()
    .split("\n")[0]
    .split(" ")[1];
  if (version !== currVersion) {
    console.log(`📦 MUST PUBLISH ${pkg}${dir} v${version}`);
    const publishCommand = `(cd packages/${dir} && pnpm publish ${
      /beta/.test(version) ? "--tag beta" : ""
    })`;
    publishCommands.push(publishCommand);
    changes = true;
  }
}

checkIfMustBePublished("utils", "@secrez");
checkIfMustBePublished("test-helpers", "@secrez");
checkIfMustBePublished("crypto", "@secrez");
checkIfMustBePublished("eth", "@secrez");
checkIfMustBePublished("core", "@secrez");
checkIfMustBePublished("fs", "@secrez");
// the deployed version is latest one
// checkIfMustBePublished('migrate', '@secrez')
checkIfMustBePublished("secrez");

if (!changes) {
  console.log("✅ No packages need to be published.");
} else {
  // Generate shell script
  const tmpPath = path.resolve(__dirname, "../tmp");
  fs.ensureDirSync(tmpPath);
  const scriptPath = path.resolve(tmpPath, "publish-packages.sh");
  const scriptContent = `#!/bin/bash

# Auto-generated publish script for Secrez packages
# This script will publish packages that need to be updated
# You'll be prompted for 2FA for each package

set -e

echo "🚀 Starting package publishing..."

${publishCommands.join("\n\n")}

echo "✅ All packages published successfully!"
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, "755");

  console.log(`
🎯 Packages need to be published! A shell script has been generated at:
   ${scriptPath}

📋 To publish all packages, run:
   ${scriptPath}

⚠️  Note: You'll be prompted for 2FA authentication for each package.
`);
}
