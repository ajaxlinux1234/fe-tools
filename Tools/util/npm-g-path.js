const shelljs = require('shelljs');
module.exports = function () {
  return shelljs.exec('npm root -g', { silent: true }).stdout.trim();
}