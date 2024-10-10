const { isEmpty } = require('lodash');
const readDir = require('../util/read-dir');
const loopMsg = require('../util/loop-msg');
const fs = require('fs');
const { getPathName } = require('../util/file');
/**
 * check keywords in send folder path
 * return keyword file path
 * @param {*} program
 */
module.exports = (program) => {
  program
    .command('changeMain')
    .description('change main ts content')
    .action(async () => {
      readDir(process.cwd(), {
        onFile: (pathname, { preFile, nextFile }) => {
          if (pathname.includes('main.ts')) {
            const content = fs.readFileSync(pathname, 'utf-8')
            const fileContent = content.replace(/#(\w+)/, `#app`)
            fs.writeFileSync(pathname, fileContent, 'utf-8')
          }
        },
      });
    });
};