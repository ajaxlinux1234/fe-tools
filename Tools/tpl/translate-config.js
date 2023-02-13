/** 翻译配置文件模版 */
const path = require('path')

module.exports = {
  // 翻译目录: 可以是文件夹路径或者文件路径, 路径使用绝对路径
  path: [process.cwd()],
  // 必传，腾讯翻译secretId
  secretId: '',
  // 必传，腾讯翻译secretKey
  secretKey: '',
  // 必传，腾讯翻译注册区域 'ap-beijing'|'ap-chengdu'|'ap-chongqing'|'ap-guangzhou'|'ap-hongkong'|'ap-seoul'|'ap-shanghai'|'ap-singapore'
  region: '',
  // 要翻译哪些后缀名的文件
  white: '.js,.ts,.jsx,.tsx,.vue',
  // 翻译后多语言文件目录
  i18nDir: path.resolve(process.cwd(), 'public', 'static', 'i18n', 'locales')
}