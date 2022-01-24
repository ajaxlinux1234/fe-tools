const shelljs = require('shelljs');

function getCurBranch() {
  return shelljs
    .exec('git rev-parse --abbrev-ref HEAD', { silent: true })
    .stdout.trim();
}

module.exports = {
  getCurBranch,
};
