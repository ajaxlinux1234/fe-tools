const { festivals } = require("./constance");
const { getDomText } = require("./utils");

/**
 * 获取当天是什么节日
 */
module.exports = async (browser, config) => {
  const page = await browser.newPage();
  await page.goto(config.url)
  const dateDom = await page.$(config.selector)
  const value = await getDomText(page, dateDom)
  return {
    date: value.trim(),
    isFestival: festivals.includes(value)
  }
}