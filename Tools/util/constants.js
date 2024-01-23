const path = require('path');
const npmGPath = require("./npm-g-path");

const cachePath = path.resolve(
  npmGPath(),
  '.cache',
  'tools.json'
);
module.exports = {
  prStoreKey: 'pr',
  GLOBAL: 'global',
  PIPE: 'pipe',
  NG: 'ng',
  TRANSLATE: 'translate',
  RULE_JSON: 'rule.js',
  cachePath,
}