const fs = require('fs')
const path = require('path')
const { logError, logSuccess } = require('../util/color-log')

const TRANSLATE_CONFIG = 'translate-config.js'

/** 翻译配置文件初始化 */
module.exports = program => {
  program
    .command('translate-init')
    .description('翻译配置文件初始化')
    .option('-P,--path [string]', '初始化目录', process.cwd())
    .action(async (info) => {
      const { path: optionPath } = info
      if (!fs.existsSync(path.resolve(optionPath, 'package.json'))) {
        return logError('请在项目根目录下初始化翻译配置文件')
      }
      const translateConfig = path.resolve(optionPath, TRANSLATE_CONFIG)
      if (fs.existsSync(translateConfig)) {
        return
      }
      fs.writeFileSync(translateConfig, fs.readFileSync(path.resolve(__dirname, '..', 'tpl', 'translate.config.js'), 'utf-8'), 'utf-8')
      logSuccess('翻译配置文件初始化完成')
    })
}