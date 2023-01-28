const fs = require('fs')
const path = require('path')

const getDomText = async (page, dom) => {
  if (!dom) {
    return ''
  }
  return await page.evaluate(el => el.textContent, dom)
}

const getDomsText = async (page, doms) => {
  const txtArr = []
  for (const dom of doms) {
    if (!dom) {
      continue
    }
    const txt = await page.evaluate(el => el.textContent, dom)
    txtArr.push(txt)
  }
  return txtArr
}


const getReadmeLog = () => {
  const readme = fs.readFileSync(`${path.resolve(__dirname, 'readme.md')}`, 'utf-8')
  const readmeArr = readme.split('\n')
  return readmeArr.filter(i => +i[0] > 0)
}


module.exports = {
  getDomText,
  getDomsText,
  getReadmeLog
}