const iExec = require('../util/i-exec');
const readDir = require('../util/read-dir');
const path = require('path')
const fs = require('fs');
const { dirname } = require('path');
/**
 * increase project RAM
 * @param {*} program 
 */
module.exports = program => {
  program
    .command('increase')
    .description('increase project RAM')
    .action(async () => {
      iExec(`increase-memory-limit`)
      readDir(path.resolve(process.cwd(), 'node_modules'), {
        ignorePath: [],
        onFile: (pathname) => {
          if (pathname.endsWith('.cmd')) {
            const ctx = fs.readFileSync(pathname, 'utf-8')
            fs.writeFileSync(pathname, ctx.replaceAll('"%_prog%"', '%_prog%'), 'utf-8')
          }
        }
      })
    })
}