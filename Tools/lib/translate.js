const fs = require('fs')
const path = require('path')

const tencentcloud = require("tencentcloud-sdk-nodejs");
const TmtClient = tencentcloud.tmt.v20180321.Client;

const parser = require("@babel/parser");
const { default: traverse } = require("@babel/traverse");
const { default: generate } = require("@babel/generator");
const compiler = require("@vue/compiler-sfc")
const { format } = require('prettier')
const { isEmpty, pick } = require('lodash')

const log = require('../util/log');
const { logError } = require('../util/color-log');
const asyncReadDir = require("../util/async-read-dir");
const store = require('../util/store');
const { TRANSLATE } = require('../util/constants');
const TemplateGenerator = require('../util/vue-transform/index');

const { removeQuotes, isNotEmpty } = require('../util/vue-transform/utils')

const zhReg = /[\u4E00-\u9FA5]+/g

const tplCNPattern = /(\<\!--)?(='")?(="')?(\s*)?[\u4E00-\u9FA5]+('+)?(\s*)?(-->)?/g
const tplCommentStart = '\x3C!--' // template注释标识符
const tplCommentEnd = '-->'
const inlineZHChart = `="'` // 标签内容中文
const inlineZHChart2 = `='"` // 标签内容中文

const jsCNPattern = /((\/)?(\/)?(\s*)?)?(\*\s)?('+)?("+)?[\u4E00-\u9FA5]+("+)?('+)?/g;
const jsTransPattern = /(\/\/(.*)?)?(\*\s)?[\u4E00-\u9FA5]+/g;
const jsComment = '//' // js注释标识符
const jsComment2 = '*'


/**
 * 翻译项目文件
 * 1.读取文件：一次读取一个文件
 * 1.1.遍历项目多语言zh_CN.json文件，如果相应的中文翻译已经在文件中，那么直接替换
 * 2.过滤掉已经存在的中文，合并字符调用翻译接口：读取5个文件调用一次翻译接口, 如果字数超过1000个字符，那么就读取4个文件，以此类推，直到读取一个文件。如果一个文件的字符超过1000个字符，那么继续拆分，
 * 3.生成翻译后的数据Map：以文件路径名filePath(两层路径)作为key，属性为 {zh: [], "zh-Hant": [], en: [], textKey: [`${filePath}.${enName}]` },
 * 4.读取所有文件：重复上述操作，生成最后的数据dataMap
 * 5.转换数据Map：
 * {
 *  filePath: {
 *    textKey: {
 *      zh: `中国${split}中国`,
 *      "zh-Hant": `中國${split}中國`,
 *      en: `China${split}China`
 *    }
 *  }
 * }
 * 生成keyMap
 * zhMap = {
 *   "中国": src.components.base.China
 * }
 * 6.写入多语言json：根据用户配置的多语言文件路径，向其中添加翻译后的内容，例如在zh文件中，判断如果原来的多语言文件存在对应的textKey，那么修改dataMap和keyMap为textKey1或者textKey2
 * {
 *  filePath: {
 *    textKey: '中国'
 *  }
 * }
 * 7.再次遍历目录，根据keyMap把中文替换成key
 * @param {*} program 
 */

/**
 * @typedef {Object} DataMapMain dataMap主要部分
 * @property {string} zh 中文内容
 * @property {string} 'zh-Hant' 翻译的中文繁体内容
 * @property {string} en 翻译的英文内容
 */

/** @typedef {DataMap & Record<string, any>} DataMap*/
/**
 * 翻译后的对象
 * * @deprecated
 * @typedef {Object} DataMap
 * @property {Record<string, DataMapMain>}
 */

/**
 * 翻译后的对象，key为中文，value为key
 * @typedef {Object} ZhMap
 * @property {Record<string, string>}
 */

/**
 * @typedef {Object} TransResult
 * @property {DataMap} dataMap 
 * @property {ZhMap} zhMap 
 */

/**@type {Object} key为`${start_end}` value为中文*/
let jsAstZhMap = {}

/** @type {string[]} template的中文*/
let tplAstZhList = []

/**@type {{TextTranslateBatch: () => Promise}} 腾讯翻译对象实例*/
let client = null
module.exports = program => {
  program
    .command('translate')
    .description('translate project')
    .option('-P,--path [string]', '翻译目录', process.cwd())
    .option('-ID,--secretId [string]', '腾讯翻译secretId', '')
    .option('-KEY,--secretKey [string]', '腾讯翻译secretKey', '')
    .option('-RE,--region [string]', '腾讯翻译注册区域', '')
    .option('-W,--white [string]', '要翻译哪些后缀名的文件', '.js,.ts,.jsx,.tsx,.vue')
    .action(async (info) => {
      const { secretId, secretKey, region, path: pathAlias, white } = info
      if (secretId && secretKey && region) {
        store.set(TRANSLATE, {
          secretId,
          secretKey,
          region
        })
      }
      /**@type {Secret} */
      const cache = store.get(TRANSLATE)
      const id = secretId || cache.secretId
      const key = secretKey || cache.secretKey
      const cmpRegin = region || cache.region
      if (!id || !key || !cmpRegin) {
        return logError('腾讯翻译开发者secretId和secretKey和腾讯云注册区域必传')
      }
      const whiteList = white.split(',')
      asyncReadDir(pathAlias, {
        ignorePath: '.git,node_modules,dist',
        async onFile(pathname) {
          const notTranslateFile = whiteList.every(suffix => !pathname.endsWith(suffix))
          if (notTranslateFile) {
            return
          }
          if (pathname !== '/Users/wangchengkun/Documents/cc-client-vue/src/components/business-modules/config/channelConfig/telCustomerService/exonNumberPool.vue') {
            return
          }
          const ctx = fs.readFileSync(pathname, 'utf-8')
          const { styles, jsAst, jsCode, tplCode, tplAst } = getReplaceCode(ctx, pathname)

          if (!zhReg.test(`${tplCode}${jsCode}`)) {
            log(pathname, '没有中文')
            return
          }

          const secretParams = {
            secretId: id,
            secretKey: key,
            region: cmpRegin
          }
          const tplChinese = getTplChinese(tplCode)
          // return
          /** 替换template中文 */
          const { zhMap: tplZhMap, dataMap: tplDataMap } = await translateByBing(tplAstZhList, pathname, secretParams)
          // const newTpl = replaceWithMaps(tplCode, {
          //   dataMap: tplDataMap,
          //   zhMap: tplZhMap,

          // })
          // return 
          class TplGenerator extends TemplateGenerator {
            genAttrs(node) {
              const { attrs = [], attrsMap = {}, propsTypeMap } = node
              if (!attrs.length) {
                return ''
              }
              const attrsMapKeys = Object.keys(attrsMap)
              attrs.forEach(attr => {
                if (zhReg.test(attr.value)) { }
              })
              return attrs
                .map(originAttr => {
                  const attr = { ...originAttr }
                  if (zhReg.test(attr.value)) {
                    const val = `$t('${tplZhMap[attr.value]}')`
                    attr.value = val
                    node.attrsMap[attr.name] = val
                    if (attr.name.startsWith(":")) {
                      return attr
                    }
                    delete attrsMap[attr.name]
                    node.attrsMap[`:${attr.name}`] = val
                    return {
                      ...attr,
                      name: `:${attr.name}`
                    }
                  }
                  return attr
                })
                .map(attr => {
                  const { name, value } = attr
                  return attrsMapKeys.find(
                    attr => `:${name}` === attr || `v-bind:${name}` === attr
                  )
                    ? ''
                    : value === '""'
                      ? `${name}`
                      : `${name}="${removeQuotes(value)}"`
                })
                .filter(isNotEmpty)
            }
          }

          const tplGenerator = new TplGenerator()
          const { code: newTpl } = tplGenerator.generate(tplAst)

          /** 替换js中文 */
          const jsZhList = Object.values(jsAstZhMap)
          const { zhMap, dataMap } = await translateByBing(jsZhList, pathname, secretParams)
          traverse(jsAst, {
            enter(path) {
              const val = typeof path.node.value === 'string' ? path.node.value : ''
              if (!val) {
                return
              }
              if (!/[\u4E00-\u9FA5]+/g.test(val)) {
                return
              }
              const { start, end } = path.node
              const zh = jsAstZhMap[`${start}_${end}`]
              path.node.extra.raw = `this.$t('${zhMap[zh]}')`
            }
          })
          const { code: newJs } = generate(jsAst)
          const newCode = getNewCode(newTpl, newJs, styles)
          fs.writeFileSync(pathname, newCode, 'utf-8')
        }
      })
    })
}

/**
 * 代码转换
 * 1.获取没有注释的ast代码
 * 2.找到其中的中文
 * 3.进行上述步骤的替换
 * 4.生成替换中文后的代码
 * @param {string} code 
 */
function getReplaceCode(code, pathname) {
  tplAstZhList = []
  jsAstZhMap = {}
  const { script: { content: js }, template: { content: tplCode }, styles } = compiler.parseComponent(code)
  const { ast } = compiler.compileTemplate({
    source: tplCode
  })
  const jsAst = parser.parse(js, {
    plugins: ['jsx', 'flow'],
    sourceType: "module",
  })

  class TplGenerator extends TemplateGenerator {
    genAttrs(node) {
      const { attrs = [], attrsMap = {} } = node
      if (!attrs.length) {
        return ''
      }
      const attrsMapKeys = Object.keys(attrsMap)
      attrs.forEach(attr => {
        if (zhReg.test(attr.value)) { }
      })
      return attrs
        .map(originAttr => {
          const attr = { ...originAttr }
          if (zhReg.test(attr.value)) {
            tplAstZhList.push(attr.value)
            return attr
          }
          return attr
        })
        // .map(originAttr => {
        //   const attr = { ...originAttr }
        //   if (zhReg.test(attr.value)) {
        //     const val = `1111`
        //     attr.value = val
        //     node.attrsMap[attr.name] = val
        //     if (attr.name.startsWith(":")) {
        //       return attr
        //     }
        //     delete attrsMap[attr.name]
        //     node.attrsMap[`:${attr.name}`] = val
        //     return {
        //       ...attr,
        //       name: `:${attr.name}`
        //     }
        //   }
        //   return attr
        // })
        .map(attr => {
          const { name, value } = attr
          return attrsMapKeys.find(
            attr => `:${name}` === attr || `v-bind:${name}` === attr
          )
            ? ''
            : value === '""'
              ? `${name}`
              : `${name}="${removeQuotes(value)}"`
        })
        .filter(isNotEmpty)
    }
  }

  const tplGenerator = new TplGenerator()
  // const tplGenerator = new TemplateGenerator()
  // const newTpl = tplGenerator.generate(ast)
  tplGenerator.generate(ast)
  traverse(jsAst, {
    enter(path) {
      const val = typeof path.node.value === 'string' ? path.node.value : ''
      if (!val) {
        return
      }
      if (!/[\u4E00-\u9FA5]+/g.test(val)) {
        return
      }
      const { start, end, value } = path.node
      jsAstZhMap[`${start}_${end}`] = value
    }
  })
  const { code: jsCode } = generate(jsAst)
  return {
    tplCode,
    jsCode,
    jsAst,
    tplAst: ast,
    styles,
    code
  }
}


/**
 * 是否是模板中的标签内中文 <input :value="'中文'" />
 * @param {string} zh 
 * @returns {boolean}
 */
function isTplInlineZH(zh) {
  return zh.startsWith(inlineZHChart)
}

/**
 * 获取模板替换
 * @param {string} key en
 * @param {string} zh zh
 */
function getCmpTplReplace(key, zh) {
  if (zh.startsWith(inlineZHChart)) {
    return `${inlineZHChart[0]}${inlineZHChart[1]}$t('${key}')`
  }
  if (zh.startsWith(inlineZHChart2)) {
    return `${inlineZHChart2[0]}${inlineZHChart2[1]}$t('${key}')`
  }
  return `{{$t('${key}')}}`
}

/**
 * 模板字符串中文数组二次处理
 */
function tplZhReplace(zh) {
  return zh.replace(inlineZHChart, '').replace(inlineZHChart2, '').replace(`'`, '')
}

/**
 * 获取template代码中的中文数组
 * @param {string} tplCode 
 * @returns string[]
 */
function getTplChinese(tplCode) {
  return tplCode.match(tplCNPattern)
}

/**
 * 获取js代码中的中文数组
 * @param {string} jsCode 
 * @returns string[]
 */
function getJSChinese(jsCode) {
  return jsCode.match(jsTransPattern)
}

/**
 * 不是注释里的中文
 * @param {string} str 
 * @returns 
 */
function isPlaintChinese(str) {
  str = str.replace(/\s/g, '')
  return !str.startsWith(jsComment) &&
    !str.startsWith(jsComment2) &&
    !str.startsWith(tplCommentStart) &&
    !str.endsWith(tplCommentEnd)
}

/**
 * 获取文件名
 * @param {string} pathname 
 * @returns 
 */
function getFileName(pathname) {
  const name = path.basename(pathname)
  const nameArr = name.split('.')
  return nameArr[0]
}

function stringToUpCase(str) {
  return str.slice(0, 1).toUpperCase() + str.slice(1, str.length)
}

/**
 * 句子转单词
 * @param {string} enName 
 * @returns {string}
 */
function sentenceToWord(enName) {
  if (!enName) {
    return enName
  }
  const arr = enName
    .replace('，', ' ')
    .replace(',', ' ')
    .split(' ')
  const enNameArr = arr
    .filter((_, m) => m === 0 || m === arr.length - 1)
    .map(stringToUpCase)
  return enNameArr.join('')
}

function trim(i) {
  return i.trim()
}

/**
 * @typedef {Object} TranslateParams
 * @property {string=} SourceText 待翻译的文本
 * @property {string[]=} SourceTextList 待翻译的文本
 * @property {'auto'|string} Source 源语言
 * @property {'en'|'zh'|'zh-TW'} Target 目标语言
 * @property {number} ProjectId 腾讯翻译项目ID
 * @property {string=} UntranslatedText 用来标记不希望被翻译的文本内容
 */

/**
 * @typedef {Object} TranslateResult
 * @property {string[]} TargetTextList
 */

/**
 * 获取腾讯云翻译结果
 * @param {Secret} secret
 * @param {TranslateParams} params 翻译参数
 * @returns {TranslateResult}
 */
async function translate(secret, params) {
  // console.log("🚀 ~ file: translate.js:452 ~ translate ~ secret", secret, params)
  const clientConfig = {
    credential: pick(secret, ['secretId', 'secretKey']),
    region: secret.region,
    profile: {
      httpProfile: {
        endpoint: "tmt.tencentcloudapi.com",
      },
    },
  };
  if (!client) {
    client = new TmtClient(clientConfig);
  }
  const res = await client.TextTranslateBatch(params)
  return res
}

/**
 * @typedef {Object} Secret
 * @property {string} secretId
 * @property {string} secretKey
 * @property {'ap-beijing'|'ap-chengdu'|'ap-chongqing'|'ap-guangzhou'|'ap-hongkong'|'ap-seoul'|'ap-shanghai'|'ap-singapore'} region
 */

/**
 * 请求必应翻译接口进行翻译
 * @param {string[]} filterList 
 * @param {string} pathname
 * @param {Secret} secret 
 * @returns {TransResult}
 */
async function translateByBing(filterList, pathname, secret) {
  const res1 = await translate(secret, {
    SourceTextList: filterList,
    Source: 'auto',
    Target: 'en',
    ProjectId: 0
  })
  const enList = res1.TargetTextList
  const res2 = await translate(secret, {
    SourceTextList: filterList,
    Source: 'auto',
    Target: 'zh-TW',
    ProjectId: 0
  })
  const TWList = res2.TargetTextList
  const fileName = getFileName(pathname)
  const dataMap = Object.fromEntries(filterList.map((i, m) => {
    const enName = enList[m]
    const name = sentenceToWord(enName)
    const TWName = TWList[m]
    return [
      `${fileName}.${name}`,
      {
        zh: i,
        en: enName,
        "zh-Hant": TWName
      }
    ]
  }))
  const zhMap = Object.fromEntries(filterList.map((i, m) => {
    const name = sentenceToWord(enList[m])
    return [
      i,
      `${fileName}.${name}`,
    ]
  }))
  return {
    dataMap,
    zhMap
  }
}

/**
 * @typedef {Object} VueStyle
 * @property {string} content
 * @property {Record<string, any>} attrs
 */
/**
 * 获取新的模板，js, style组合后的代码
 * @param {string} tplCode 
 * @param {string} jsCode 
 * @param {VueStyle[]} styles
 * @returns {string}
 */
function getNewCode(tplCode, jsCode, styles) {
  const tpl = `<template>${addSpaceByLine(tplCode)}</template>`
  const js = `
  <script>
    ${addSpaceByLine(jsCode, 2, 0)}
  </script>\n`
  const styleStr = styles.map((i, m) => {
    const style = i.attrs.scoped ?
      `<style lang="stylus" scoped>${addSpaceByLine(i.content)}</style>\n` :
      `<style lang="stylus">${addSpaceByLine(i.content)}</style>\n`
    return style
  }).join('')
  const newCode = `${tpl}${js}${styleStr}`
  return newCode
}

/**
 * 为代码添加前置空格
 * @param {string} code 
 * @param {number=} space 空格数量
 * @param {(number|null)=} noSpaceIndex 第几行不添加空格
 * @returns 
 */
function addSpaceByLine(code, space = 2, noSpaceIndex) {
  const codeArr = code.split('\n')
  const spaceStr = ' '.repeat(space)
  const spaceCode = codeArr.map((i, m) => `${noSpaceIndex === m ? '' : spaceStr}${i}`).join('\n')
  return spaceCode
}

/**
 * 根据拿到中文字符数组对其中的代码进行替换
 * @param {string} code 
 * @param {Record<string, any>} options 
 * @param {DataMap} options.dataMap 
 * @param {ZhMap} options.zhMap
 * @param {RegExp} options.codeReg
 * @param {RegExp} options.keyReg
 * @param {function} options.strTpl
 * @returns 新的code字符串
 */
function replaceWithMaps(code, options) {
  const {
    zhMap,
    codeReg = jsCNPattern,
    keyReg = /'/g,
    strTpl = key => `this.$t('${key}')`
  } = options
  const newCode = code.replace(codeReg, (zh) => {
    if (!zh) {
      return zh
    }
    const chinese = tplZhReplace(zh)
    if (!isPlaintChinese(chinese)) {
      return chinese
    }
    const filterChinese = chinese.replace(keyReg, '')
    const key = zhMap[filterChinese]
    return strTpl(key, zh)
  })
  return newCode
}


