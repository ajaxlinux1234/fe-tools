const originPath = require('path');
const shelljs = require('shelljs');
const eachAsync = require('../util/each-async');
const loopMsg = require('../util/loop-msg');
const store = require('../util/store');
const fs = require('fs');
const { getPathName } = require('../util/file');
/**
 * Batch copy files and submit commits
 * If the compressed file is copied to the current project -> decompress the file -> copy the file to the directory to be copied -> delete the zip file and the decompressed file
 * Ordinary files or folders do not have the first two
 * .option('--path <string>', 'compression icon zip path')
 * .option('--replace [string...]', 'The path to replace is already a file')
 * .option('--commit [string]', 'Description when git commit -m')
 * @param {*} program
 */
module.exports = function (program) {
  program
    .command('cp')
    .description('File replacement')
    .option('--path <string>', 'compression icon zip path')
    .option('--replace [string...]', 'The path to replace is already a file')
    .option('--commit [string]', 'Description when git commit -m')
    .action(async (info) => {
      const path = info.path || store.get('cp').path || process.cwd();
      const replace = info.replace || store.get('cp').replace;
      const msg = [
        [!replace, 'The address or file to be copied must be passed']
      ];
      if (loopMsg(msg)) {
        return;
      }
      const basename = originPath.basename(path).trim();
      shelljs.exec(`cp -r ${path} ${process.cwd()}`, { silent: true });
      const isZip = originPath.extname(path) === '.zip';
      const unzipInfo = isZip ?
        shelljs.exec(
          `unzip -o ${originPath.resolve(process.cwd(), basename)}`, { silent: true }
        ) :
        originPath.resolve(process.cwd(), path);

      const unzipName = isZip ?
        unzipInfo.stdout.match(/(?<=inflating: )([^/])*/)[0] :
        originPath.resolve(process.cwd(), getPathName(path).name);
      await eachAsync(
        replace.map((target) => async () => {
          const { to, from } = getPathMap({ target, fromName: unzipName });
          const stats = fs.statSync(from);
          if (stats.isFile()) {
            shelljs.exec(`rm -rf ${to} && cp ${from} ${to}`);
          } else {
            shelljs.exec(`rm -rf ${to} && cp -R ${from} ${to}`);
          }
        })
      );
      shelljs.exec(
        `rm -rf ${originPath.resolve(
          process.cwd(),
          basename
        )} && rm -rf ${originPath.resolve(process.cwd(), unzipName)} `, { silent: true }
      );
      const commit = info.commit || store.get('cp').commit;
      if (commit) {
        await eachAsync(
          replace.map((target) => async () => {
            shelljs.exec(
              `git add ${getPathMap({ target, fromName: unzipName }).to}`, {
              silent: true,
            }
            );
          })
        );
        shelljs.exec(`git commit -m "${commit}"`, { silent: true });
      }
      store.set('cp', {
        path,
        replace,
        commit,
      });
    });
};

function getPathMap({ target, fromName }) {
  let to = target.split('$')[0] || '';
  let from = target.split('$')[1] || '';
  from = from ?
    originPath.resolve(process.cwd(), fromName, from) :
    originPath.resolve(fromName, from);
  to = to ? originPath.resolve(process.cwd(), to) : originPath.resolve(to);
  return {
    from,
    to,
  };
}