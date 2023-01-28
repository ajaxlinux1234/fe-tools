const { uniq, isFunction, curry } = require('lodash');
const fs = require('fs')
const path = require('path')
const dayjs = require('dayjs')
const { data: starsName } = require('./analysisData/stars.json');
const hotStarObj = require('./analysisData/hotStarObj.json')
const { getDomsText, getDomText } = require("./utils");
const eachAsync = require('../../util/each-async');
const { sleep } = require('../../util/util');
const { starKeywords, day } = require('./constance');


const isStarName = async (page, str, config) => {
  await page.goto(`${config.searchUrl}${str}`)
  const titleDom = await page.$(config.keSelector)
  const titleStr = getDomText(page, titleDom)
  if (!titleStr || !isFunction(titleStr.includes)) {
    return ''
  }
  return (titleStr.includes(str) && starKeywords.some(i => titleStr.includes(i))) ? str : ''
}

/**
 * 更新当日热点
 * @param {} list 
 */
const updateDayStarsName = (list) => {
  const hot = { ...hotStarObj }
  hot[day] = list
  const starsNamePath = path.resolve(__dirname, 'analysisData', 'hotStarObj.json')
  fs.writeFileSync(
    starsNamePath,
    JSON.stringify(
      hot,
      null,
      4
    ),
    'utf-8'
  );
}

/**
 * 更新名单列表
 * @param {} list 
 */
const updateStarsName = (list) => {
  const newList = uniq([...starsName, ...list]).filter(i => i)
  const starsNamePath = path.resolve(__dirname, 'analysisData', 'stars.json')
  fs.writeFileSync(
    starsNamePath,
    JSON.stringify(
      {
        data: newList
      },
      null,
      4
    ),
    'utf-8'
  );
}

/**
 * 获取热搜中的名字
 * 获取事件中的前四个字符，然后在百度中搜索，查看相应的字符串是否有百度百科结果
 * 如果有暂且认为这是个明星名字
 */
const getHotStarsName = async (browser, hotList, config) => {
  const page = await browser.newPage();
  const result = []
  const filterStarsName = starsName.filter(starName => hotList.some(i => i.includes(starName)))
  result.push(...filterStarsName)
  const similarNameOne = []
  const similarNameTwo = []
  const similarNameThree = []
  await eachAsync(hotList.map(i => i.substring(0, 2)).map((i) => async () => {
    const name = await isStarName(page, i, config)
    await sleep(1000)
    similarNameOne.push(name)
  }))
  await eachAsync(hotList.map(i => i.substring(0, 3)).map((i) => async () => {
    const name = await isStarName(page, i, config)
    await sleep(1000)
    similarNameTwo.push(name)
  }))
  // await eachAsync(hotList.map(i => i.substring(0, 4)).map((i) => async () => {
  //   const name = await isStarName(page, i, config)
  //   await sleep(1000)
  //   similarNameThree.push(name)
  // }))
  const newNames = [...similarNameOne, ...similarNameTwo, ...similarNameThree]
  updateStarsName(newNames)
  result.push(...newNames)
  return uniq(result).filter(i => i)
}

const getHot = async ({ page, url, browser, config }) => {
  await page.goto(url)
  const doms = await page.$$('.main .rs-nav-list a')
  const domsHot = await getDomsText(page, doms)
  const domsStarts = await getHotStarsName(browser, domsHot, config)
  return domsStarts
}


module.exports = async (browser, config) => {
  const page = await browser.newPage();
  if (hotStarObj[day]) {
    return hotStarObj[day]
  }
  const todayHeadlines = await getHot({ page, url: 'http://resou.today/art/11.html', browser, config })
  const weiBo = await getHot({ page, url: 'http://resou.today/art/6.html', browser, config })
  const baiDu = await getHot({ page, url: 'http://resou.today/art/10.html', browser, config })
  const tikTok = await getHot({ page, url: 'http://resou.today/art/10.html', browser, config })
  const result = [...todayHeadlines, ...weiBo, ...baiDu, ...tikTok]
  updateDayStarsName(result)
  return result
}