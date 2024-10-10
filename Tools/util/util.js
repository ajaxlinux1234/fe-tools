const fs = require('fs')
const path = require('path')
const npmGPath = require('./npm-g-path');
const os = require('os');
const { exec } = require('child_process');
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
const isWin = process.platform.includes('win');
const getNameSpace = function () {
  try {
    return require(path.resolve(process.cwd(), 'package.json')).name;
  } catch (error) {
    return 'default';
  }
};

const initCache = () => {
  const cacheFile = path.resolve(npmGPath(), '.cache')
  if (!fs.existsSync(cacheFile)) {
    fs.mkdirSync(cacheFile)
  }
  if (!fs.existsSync(path.resolve(cacheFile, 'tools.json'))) {
    fs.writeFileSync(path.resolve(cacheFile, 'tools.json'), JSON.stringify({}))
  }

}

function openUrlInBrowser(url) {
  const platform = os.platform();
  let command;

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "" "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`; // Linux
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`执行错误: ${error}`);
      return;
    }
    console.log(`成功打开了网址: ${url}`);
  });
}

module.exports = {
  sleep,
  isWin,
  getNameSpace,
  initCache,
  openUrlInBrowser
};
