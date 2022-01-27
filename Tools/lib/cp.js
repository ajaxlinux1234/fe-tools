const originPath = require('path');
const shelljs = require('shelljs');
const eachAsync = require('../util/each-async');
const loopMsg = require('../util/loop-msg');
const store = require('../util/store');
const fs = require('fs');
const { getPathName } = require('../util/file');
/**
 * 批量拷贝文件，并提交commit
 * 如果是压缩文件copy到当前项目 -> 解压文件 -> 把文件copy到要copy的目录 -> 删除zip文件和解压之后的文件
 * 普通文件或者文件夹没有前两部
 * .option('--path <string>', '压缩图标zip路径')
 * .option('--replace [string...]', '要替换的路径已经文件')
 * .option('--commit [string]', 'git commit -m 时的描述内容')
 * @param {*} program
 */
module.exports = function (program) {
  program
    .command('cp')
    .description('文件替换')
    .option('--path <string>', '压缩图标zip路径')
    .option('--replace [string...]', '要替换的路径已经文件')
    .option('--commit [string]', 'git commit -m 时的描述内容')
    .action(async (info) => {
      const path = info.path || store.get('cp').path || process.cwd();
      const replace = info.replace || store.get('cp').replace;
      const msg = [[!replace, '要copy的地址或文件必传']];
      if (loopMsg(msg)) {
        return;
      }
      const basename = originPath.basename(path).trim();
      shelljs.exec(`cp -r ${path} ${process.cwd()}`, { silent: true });
      const isZip = originPath.extname(path) === '.zip';
      const unzipInfo = isZip
        ? shelljs.exec(
            `unzip -o ${originPath.resolve(process.cwd(), basename)}`,
            { silent: true }
          )
        : originPath.resolve(process.cwd(), path);

      const unzipName = isZip
        ? unzipInfo.stdout.match(/(?<=inflating: )([^/])*/)[0]
        : originPath.resolve(process.cwd(), getPathName(path).name);
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
        )} && rm -rf ${originPath.resolve(process.cwd(), unzipName)} `,
        { silent: true }
      );
      const commit = info.commit || store.get('cp').commit;
      if (commit) {
        await eachAsync(
          replace.map((target) => async () => {
            shelljs.exec(
              `git add ${getPathMap({ target, fromName: unzipName }).to}`,
              {
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
  from = from
    ? originPath.resolve(process.cwd(), fromName, from)
    : originPath.resolve(fromName, from);
  to = to ? originPath.resolve(process.cwd(), to) : originPath.resolve(to);
  return {
    from,
    to,
  };
}
