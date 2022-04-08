const { isEmpty } = require('lodash');
const readDir = require('../util/read-dir');
const loopMsg = require('../util/loop-msg');
const fs = require('fs');
/**
 * check keywords in send folder path
 * return keyword file path
 * @param {*} program
 */
module.exports = (program) => {
  program
    .command('check-ctx')
    .description('get keywords file path')
    .option('-P,--path [string]', 'folder path', process.cwd())
    .option('-K,--keywords [string...]', 'keywords string or Regex', [])
    .option('-I,--ignore-path [string]', 'Traverse file ignored paths')
    .action(async (info) => {
      const { keywords, path, ignorePath } = info;
      const msg = [
        [isEmpty(keywords), 'keywords param is need'],
        [
          keywords.some((i) => typeof i !== 'string'),
          'keywords item must be string',
        ],
      ];
      if (loopMsg(msg)) {
        return;
      }
      const regexList = keywords.map((i) => {
        const regex = new RegExp(i);
        return new RegExp(
          regex,
          `${regex.flags
            .split('')
            .filter((i) => i !== 'm' && i !== 'g')
            .join('')}mg`
        );
      });
      const result = [];
      readDir(path, {
        ignorePath,
        onFile: (pathname) => {
          const ctx = fs.readFileSync(pathname, 'utf-8');
          if (regexList.some((regex) => regex.test(ctx))) {
            result.push(pathname);
          }
        },
      });
      if (!isEmpty(result)) {
        console.log(`keywords ${keywords} are found in:\n`, [result].toString());
      }
    });
};