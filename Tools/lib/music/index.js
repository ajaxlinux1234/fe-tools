/**
 * create music self media
 * @param {*} program 
 */
const puppeteer = require('puppeteer');
const log = require('../../util/log');
const { browserMap } = require('./constance');
const getHotSearch = require('./getHotSearch');
const getNowDate = require('./getNowDate');
const searchInfoInQQMusic = require('./searchInfoInQQMusic')
const { getReadmeLog } = require('./utils');


const optionsLaunch = {
  args: ['--no-sandbox',],
  headless: false,
  ignoreHTTPSErrors: true,
  executablePath: puppeteer.executablePath(),
};
module.exports = program => {
  program
    .command('music')
    .description('create music self media')
    // .option('-C,--all-cache-info', 'show tools all cache info')
    // .option('-CK, --cache-keys', 'show cache keys')
    // .option('-COI,--cache-one-info <string>', 'get cache item')
    .action(async () => {
      const browser = await puppeteer.launch(optionsLaunch)
      const config = browserMap.get('bing')
      const { isFestival, date } = await getNowDate(browser, config)
      const logArr = getReadmeLog()
      log(`${logArr.shift()}：${date}`)
      const hotStars = await getHotSearch(browser, config)
      log(`${logArr.shift()}：${hotStars}`)
      await searchInfoInQQMusic(browser)
    })
}