/** 翻译配置文件模版 */
const path = require('path')

module.exports = {
  // 翻译目录: 可以是文件夹路径或者文件路径
  path: [process.cwd()],
  // 必传，腾讯翻译secretId
  secretId: '',
  // 必传，腾讯翻译secretKey
  secretKey: '',
  // 必传，腾讯翻译注册区域 'ap-beijing'|'ap-chengdu'|'ap-chongqing'|'ap-guangzhou'|'ap-hongkong'|'ap-seoul'|'ap-shanghai'|'ap-singapore'
  region: '',
  // 要翻译哪些后缀名的文件
  white: '.vue',
  // 翻译后多语言写入的文件目录
  i18nDir: path.resolve(process.cwd(), 'public', 'static', 'i18n', 'locales'),
  // 翻译后多语言写入的文件名，只支持中文简体，中文繁体，英文三种形式
  i18nFileMap: {
    zh: 'zh_CN.json',
    'zh-Hant': 'zh_TW.json',
    en: 'en.json'
  },
  // 命名空间，翻译后的数据对象放到哪个对象里面，多层对象{a: {b: {}}}写法是a.b
  namespace: '',
  // 忽略的文件
  ignores: ['/Users/wangchengkun/Documents/managev/src/components/footer/index.vue'],
  // 根据文件已有的多语言内容自动获取命名空间
  autoNamespace: false,
  // 没有国际化时国际化的导入字符串
  i18nImportStr: function (tplStr) {
    if (tplStr.includes('useI18n')) {
      return false
    }
    return `
    import { useI18n } from 'vue-i18n';
    const { t } = useI18n();
    `
  },
  // 国际化使用时的函数名称字符串
  i18nUseName: 't',
  // 组合的时候script在最上面
  scriptFirst: true,
}