const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const preview =
  process.argv.includes("--preview") || process.argv.includes("--dry-run");

let packages = {};
execSync("git diff main --name-only")
  .toString()
  .split("\n")
  .map((e) => {
    let m = e.split("/");
    if (m[0] === "packages" && (m[2] === "src" || m[2] === "package.json")) {
      packages[m[1]] = true;
    }
    return e;
  });

let packagesFolder = fs.readdirSync(path.resolve(__dirname, "../packages"));

let packagesJson = {};

for (let package0 of packagesFolder) {
  let pjsonPath = path.resolve(
    __dirname,
    "../packages",
    package0,
    "package.json"
  );
  if (fs.existsSync(pjsonPath)) {
    packagesJson[package0] = require(path.resolve(
      __dirname,
      "../packages",
      package0,
      "package.json"
    ));
  }
}

function getExistingVersion(pkg) {
  return execSync(`npm view ${pkg} | grep latest`)
    .toString()
    .split("\n")[0]
    .split(" ")[1];
}

function getVersionToPublish(packageVersion, publishedVersion) {
  if (packageVersion !== publishedVersion) {
    return packageVersion;
  }
  let v = packageVersion.split(".");
  v[2] = parseInt(v[2], 10) + 1;
  return v.join(".");
}

function updateOtherPackages(package0, name, newVersion) {
  console.debug("Patching " + package0 + " to version " + newVersion);
  for (let p in packagesJson) {
    if (p === package0) {
      continue;
    }
    let json = packagesJson[p];
    let yes = false;
    if (json.dependencies[name]) {
      json.dependencies[name] = "workspace:~" + newVersion;
      yes = true;
    }
    if (json.devDependencies[name]) {
      json.devDependencies[name] = "workspace:~" + newVersion;
      yes = true;
    }
    if (yes) {
      console.debug("Updating dependencies in", p);
    }
  }
}

if (preview) {
  const changed = Object.keys(packages).filter((p) => packagesJson[p]);
  if (!changed.length) {
    console.log("No packages changed against main.");
  } else {
    for (let p of changed) {
      let { version, name } = packagesJson[p];
      let published = getExistingVersion(name);
      let toPublish = getVersionToPublish(version, published);
      console.log(
        `${p} (${name}): published ${published}, to publish ${toPublish}`
      );
    }
  }
} else {
  for (let p in packages) {
    let json = packagesJson[p];
    if (json) {
      let { version, name } = json;
      if (version === getExistingVersion(name)) {
        let v = getVersionToPublish(version, version);
        json.version = v;
        updateOtherPackages(p, name, v);
      }
    }
  }

  for (let p in packagesJson) {
    fs.writeFileSync(
      path.resolve(__dirname, "../packages", p, "package.json"),
      JSON.stringify(packagesJson[p], null, 2) + "\n"
    );
  }

  console.debug("Done");
}
