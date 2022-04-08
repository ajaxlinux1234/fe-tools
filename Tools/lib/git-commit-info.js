const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');

module.exports = function (program) {
  program
    .command('git-commit-info')
    .description("Generate git's most recent commitId and time into the file")
    .option('--folder [string]', 'The path to store version.txt', path.resolve(process.cwd(), 'dist', 'version.txt'))
    .action(async (info) => {
      const { folder: vPath } = info;
      const { stdout: fullCommitId } = await shelljs.exec('git log --format="%H" -n 1', { silent: true });
      const { stdout: author } = await shelljs.exec("git log -1 --pretty=format:'%an'", { silent: true })
      const { stdout: lastInfo } = await shelljs.exec("git log -1 --pretty=%B", { silent: true })
      const { stdout: time } = await shelljs.exec('git log -1 --format=%cd', { silent: true });
      const { stdout: commitId } = await shelljs.exec('git log --format="%h" -n 1', { silent: true });
      fs.writeFileSync(`${vPath}`, [fullCommitId, author, lastInfo, time, commitId].join('\n'), 'utf-8')
    });
};