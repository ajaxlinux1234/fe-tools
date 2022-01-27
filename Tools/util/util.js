const path = require('path');
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
const isWin = process.platform.includes('win');
const getNameSpace = function () {
  try {
    return require(path.resolve(process.cwd(), 'package.json')).name;
  } catch (error) {
    return 'default';
  }
};
module.exports = {
  sleep,
  isWin,
  getNameSpace,
};
