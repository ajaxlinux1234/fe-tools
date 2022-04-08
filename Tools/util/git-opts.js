const shelljs = require('shelljs');

function getCurBranch() {
  return shelljs
    .exec('git rev-parse --abbrev-ref HEAD', { silent: true })
    .stdout.trim();
}

function hasRemote(branch) {
  return shelljs
    .exec('git branch --remote', { silent: true })
    .stdout.includes(branch);
}

function createRemote(branch) {
  return shelljs.exec(`git push origin ${branch}`, { silent: true });
}

module.exports = {
  getCurBranch,
  hasRemote,
  createRemote,
};
