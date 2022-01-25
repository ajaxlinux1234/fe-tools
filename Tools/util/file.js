const fs = require('fs');
const { last } = require('lodash');
const path = require('path');
const { isWin } = require('./util');
async function createFile(pathStr) {
  return new Promise((resolve) =>
    fs.access(pathStr, fs.F_OK, (err) => {
      if (err) {
        const { name, dir } = getPathName(pathStr);
        const isFile = !!path.extname(name);
        if (isFile) {
          dir && fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(name, null, 'utf-8');
        } else {
          fs.mkdirSync(pathStr, { recursive: true });
        }
        resolve();
      }
      resolve();
    })
  );
}

function getPathName(pathStr) {
  const cmpPath = isWin ? path.normalize(pathStr) : pathStr;
  const list = cmpPath.split(path.sep);
  return {
    name: last(list),
    dir: list.filter((i, m) => m !== list.length - 1).join(path.sep),
  };
}

module.exports = {
  createFile,
  getPathName,
};