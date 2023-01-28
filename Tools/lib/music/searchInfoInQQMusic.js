const { dayStars } = require('./constance')
const axios = require('axios');
const { get } = require('lodash');
const { sleep } = require('../../util/util');
/**
 * 拿到当日的热点明星名单，在qq音乐上搜索对应明星的mv，歌曲，还有歌曲以及歌手文案
 * @param {} browser 
 */

const getUrl = (key) => `https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg?_=${+new Date()}&cv=4747474&ct=24&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=1&uin=0&g_tk_new_20200303=5381&g_tk=5381&hostUin=0&is_xml=0&key=${encodeURIComponent(key)}`
module.exports = async (browser) => {
  const page = await browser.newPage();
  await page.goto('https://y.qq.com/')
  if (!dayStars.length) {
    return {}
  }
  for (const item of dayStars) {
    const url = getUrl(item)
    const res = await axios.get(url)
    const singerCode = get(res, 'data.data.singer.itemlist.[0].mid')
    if (!singerCode) {
      continue
    }
    await page.goto(`https://y.qq.com/n/ryqq/singer/${singerCode}`)
    const doms = await page.$$('.list_menu__play')
    console.log("🚀 ~ file: searchInfoInQQMusic.js:26 ~ module.exports= ~ doms", doms.length)
    await page.click('.list_menu__play')
    // for (const dom of doms) {
    //   await dom.click()
    //   const newPage = await browser.newPage();
    //   await newPage.goto('https://y.qq.com/n/ryqq/player')
    //   await sleep(1000)
    //   const audio = await newPage.$('audio')
    //   const src = await newPage.evaluate(el => el.src, audio)
    //   console.log("🚀 ~ file: searchInfoInQQMusic.js:27 ~ module.exports= ~ domRes", src)
    //   // await page.waitForSelector("audio");
    // }
  }
}
