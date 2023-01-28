const fs = require('fs')
const path = require('path')
const npmGPath = require('./npm-g-path');
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
module.exports = {
  sleep,
  isWin,
  getNameSpace,
  initCache
};
