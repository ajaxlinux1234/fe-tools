
const { cachePath } = require('../util/constants');
// const iExec = require('../util/i-exec');
// const log = require('../util/log');
// const shelljs = require('shelljs')
const fs = require('fs')
const { get } = require('lodash')
/**
 * set node RAM
 * @param {*} program 
 */
module.exports = program => {
  program
    .command('debug')
    .description('show tools some info')
    .option('-C,--all-cache-info', 'show tools all cache info')
    .option('-CK, --cache-keys', 'show cache keys')
    .option('-COI,--cache-one-info <string>', 'get cache item')
    .action(async (info) => {
      const { allCacheInfo, cacheOneInfo, cacheKeys } = info;
      const cacheCtx = fs.readFileSync(cachePath, 'utf-8')
      const parseCtx = JSON.parse(cacheCtx)
      if (allCacheInfo) {
        return console.log(cacheCtx)
      }
      if (cacheKeys) {
        return console.log(Object.keys(parseCtx))
      }
      if (cacheOneInfo) {
        return console.log(JSON.stringify(get(parseCtx, cacheOneInfo), null, 4))
      }
    })
}