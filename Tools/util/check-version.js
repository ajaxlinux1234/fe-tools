const spawn = require("cross-spawn");
const compareVersion = require("compare-versions");
const inquirer = require("inquirer");
const pkgName = require("../package.json").name;
module.exports = async function () {
  const localVersion = getLocalVersion();
  const originVersion = getOriginVersion();
  if (compareVersion(originVersion, localVersion) > 0) {
    console.log(
      `originVersion ${originVersion} > localVersion ${localVersion}`
    );
    const needUpdate = await inquirer.prompt([{
      type: "confirm",
      require: true,
      name: "value",
      message: `${pkgName} has new version，update？`,
      default: true
    }]);
    if (needUpdate.value) {
      spawn.sync("npm", ["install", `${pkgName}@${originVersion}`, "-g"], {
        stdio: "inherit"
      });
      return true;
    }
  } else {
    console.log(`localVersion ${localVersion} is latest`);
  }
};

function getLocalVersion() {
  try {
    const { version } = require(path || "../package.json");
    return version[0] === "^" || version[0] === "~" ?
      version.slice(1) :
      version;
  } catch (error) {
    return "";
  }
}

function getOriginVersion() {
  const info = JSON.parse(
    spawn.sync("npm", ["info", pkgName, "--json"]).stdout.toString()
  );
  const lastDistTags = info["dist-tags"].latest;

  if (isStableVersion(lastDistTags)) {
    return lastDistTags;
  } else {
    const versions = info.versions.reverse();
    return versions.find(isStableVersion);
  }
}

function isStableVersion(version) {
  return version.indexOf("-") === -1;
}