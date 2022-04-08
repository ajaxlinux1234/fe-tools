const ibili = require('ibili')
/**
 * https://www.npmjs.com/package/f2elint
 * @param {*} program 
 */
module.exports = function (program) {
  program
    .command('load')
    .description('download movie')
    .option('-U,--urls [string...]', 'urlList')
    .action(async (info) => {
      const { urls } = info
      for await (const url of urls) {
        await ibili.downloadVideo({
          url,
          folder: process.cwd(),
          sessdata: 'b6714909%2C158***3693%2C1a29f0c1'
        })
        console.log('download one')
      }
    })
}