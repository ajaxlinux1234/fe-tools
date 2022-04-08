
const iExec = require('../util/i-exec');
const log = require('../util/log');
/**
 * set node RAM
 * @param {*} program 
 */
module.exports = program => {
  program
    .command('setRAM')
    .description('set Nodejs RAM')
    .option('-S,--size <number>', 'size', 4096)
    .action(async (info) => {
      const { size } = info;
      iExec(`export NODE_OPTIONS=--max_old_space_size=${size}`)
      log(`nodejs memory has been expanded to ${size}`);
    })
}