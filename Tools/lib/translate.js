const fs = require('fs')
const path = require('path')

const shelljs = require('shelljs')

const tencentcloud = require("tencentcloud-sdk-nodejs");
const TmtClient = tencentcloud.tmt.v20180321.Client;

const parser = require("@babel/parser");
const { default: traverse } = require("@babel/traverse");
const { default: generate } = require("@babel/generator");
const compiler = require("@vue/compiler-sfc")
const { pick, isEmpty, get, set } = require('lodash')

const log = require('../util/log');
const { logError, logSuccess } = require('../util/color-log');
const asyncReadDir = require("../util/async-read-dir");
const store = require('../util/store');
const { TRANSLATE } = require('../util/constants');
const TemplateGenerator = require('../util/vue-transform/index');

const { removeQuotes, isNotEmpty } = require('../util/vue-transform/utils');
const onCopy = require('../util/on-copy');
const { sleep } = require('../util/util');

const zhReg = /[\u4E00-\u9FA5]+/g

/**
 * @typedef {Object} DataMapMain dataMap主要部分
 * @property {string} zh 中文内容
 * @property {string} 'zh-Hant' 翻译的中文繁体内容
 * @property {string} en 翻译的英文内容
 */

/**
 * 翻译后的对象
 * * @deprecated
 * @typedef {Object} DataMap
 * @property {Record<'zh'|'zh-Hant'|'en', DataMapMain>}
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

/**@type {{TextTranslateBatch: () => Promise}} 腾讯翻译对象实例*/
let client = null
module.exports = program => {
  program
    .command('translate')
    .description('translate project')
    .option('-P,--path [string...]', '翻译目录路径或文件路径', [process.cwd()])
    .option('-ID,--secretId [string]', '腾讯翻译secretId', '')
    .option('-KEY,--secretKey [string]', '腾讯翻译secretKey', '')
    .option('-RE,--region [string]', '腾讯翻译注册区域', '')
    .option('-N,--namespace [string]', '命令空间', '')
    .option('-AUTO,--autoNamespace [boolean]', '是否启用自动获取命令空间', '')
    .option('-W,--white [string]', '要翻译哪些后缀名的文件', '.vue')
    .option('-I18N,--i18nDir [string]', '翻译后多语言文件目录', path.resolve(process.cwd(), 'public', 'static', 'i18n', 'locales'))
    .option('-I18NF,--i18nFileMap', '翻译后多语言文件文件名', { zh: 'zh_CN.json', 'zh-Hant': 'zh_TW.json', en: 'en.json' })
    .action(async (info) => {
      const transConfigPath = path.resolve(process.cwd(), 'translate-config.js')
      const translateConfig = fs.existsSync(transConfigPath) ? require(transConfigPath) : null
      const { secretId, secretKey, region, path: originPath, white, i18nDir, i18nFileMap, namespace, autoNamespace } = translateConfig || info
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
      const pathAlias = originPath || cache.path
      if (!id || !key || !cmpRegin) {
        return logError('腾讯翻译开发者secretId和secretKey和腾讯云注册区域必传')
      }
      const whiteList = white.split(',')

      /**
       * 操作主函数
       * @param {string} pathname 
       * @param {boolean=} [autoNameSpace=false] 自动获取命名空间
       * @returns 
       */
      async function main(pathname, autoNameSpace) {
        const notTranslateFile = whiteList.every(suffix => !pathname.endsWith(suffix))
        if (notTranslateFile) {
          return {}
        }
        const ctx = fs.readFileSync(pathname, 'utf-8')
        const { styles, jsAst, jsCode, tplCode, tplAst, tplAstZhList, jsAstZhMap } = getReplaceCode(ctx, pathname)
        if (!zhReg.test(`${tplCode}${jsCode}`)) {
          logError(`${pathname}没有中文`)
          return {}
        }

        const secretParams = {
          secretId: id,
          secretKey: key,
          region: cmpRegin
        }
        logWrapper.fileName = getFileName(pathname, true)
        logWrapper('开始翻译替换vue template中文')
        /** 替换template中文 */
        const { zhMap: tplZhMap, dataMap: tplDataMap } = await translateByEngine(tplAstZhList, pathname, secretParams, namespace, autoNamespace, ctx)

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
                  const val = `$t('${tplZhMap[removeQuotes(attr.value)]}')`
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

          genText(node) {
            const { text = '' } = node
            return isTplTextType(text) ? `{{$t('${tplZhMap[text]}')}}` : text
          }
        }

        const tplGenerator = new TplGenerator()
        const { code: newTpl } = tplGenerator.generate(tplAst)

        logWrapper('翻译替换vue template中文成功')

        logWrapper('开始翻译替换vue script中文')
        /** 替换js中文 */
        const jsZhList = Object.values(jsAstZhMap)
        const { zhMap, dataMap } = await translateByEngine(jsZhList, pathname, secretParams, namespace, autoNamespace, ctx)
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
        logWrapper('翻译替换vue script中文成功')

        logWrapper('开始写入格式化的vue文件')
        /** 写入文件后重新格式化 */
        const newCode = getNewCode(newTpl, newJs, styles)
        fs.writeFileSync(pathname, newCode, 'utf-8')
        shelljs.exec(`npx prettier --write ${pathname}`, { silent: true })
        await sleep(500)
        logWrapper('写入成功')
        const mergeMap = { ...tplDataMap, ...dataMap }
        return getI18nJson(mergeMap, pathname, namespace, autoNamespace, ctx)
      }
      let zhObj = {}
      let zhHantObj = {}
      let enObj = {}
      for (const index in pathAlias) {
        const sendPath = pathAlias[index]
        if (index !== 0) {
          console.log('\n')
        }
        const stats = fs.statSync(sendPath)
        if (stats.isFile(sendPath)) {
          const code = fs.readFileSync(sendPath, 'utf-8')
          const preName = getNamePre(namespace, sendPath, autoNamespace, code)
          const { zhObj: zhObjOne, zhHantObj: zhHantObjOne, enObj: enObjOne } = await main(sendPath, autoNamespace)
          zhObj[preName] = zhObjOne
          zhHantObj[preName] = zhHantObjOne
          enObj[preName] = enObjOne
        } else {
          await asyncReadDir(sendPath, {
            ignorePath: '.git,node_modules,dist',
            async onFile(pathname) {
              const code = fs.readFileSync(pathname, 'utf-8')
              const preName = getNamePre(namespace, pathname, autoNamespace, code)
              const { zhObj: zhObjOne, zhHantObj: zhHantObjOne, enObj: enObjOne } = await main(pathname, autoNamespace)
              zhObj[preName] = zhObjOne
              zhHantObj[preName] = zhHantObjOne
              enObj[preName] = enObjOne
            }
          })
        }
      }
      onCopy({
        zhObj
      })
      if (isEmpty(Object.values(zhObj)[0])) {
        return logWrapper('没有内容需要被写入到多语言配置文件')
      }
      logWrapper('开始写入多语言配置文件')
      const { zh: zhPath, en: enPath, 'zh-Hant': zhHantPath } = getI18nFilePath(i18nDir, i18nFileMap)

      const zhJSON = require(zhPath)
      const zhHantJSON = require(zhHantPath)
      const enJSON = require(enPath)

      const zh = mergeJSON(zhObj, zhJSON, '中文翻译json文件写入失败')
      const zhHant = mergeJSON(zhHantObj, zhHantJSON, '中文繁体翻译json文件写入失败')
      const en = mergeJSON(enObj, enJSON, '英文翻译json文件写入失败')
      fs.writeFileSync(zhPath, JSON.stringify(zh, null, 2), 'utf-8')
      fs.writeFileSync(zhHantPath, JSON.stringify(zhHant, null, 2), 'utf-8')
      fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf-8')
      logWrapper('写入多语言配置文件成功')
    })
}

/**
 * 
 * @param {string} str 
 */
function logWrapper(str) {
  logSuccess(`文件${logWrapper.fileName}: ${str}`)
}

/**
 * 写入多语言配置文件
 * @param {DataMap} map 
 * @param {string} pathname 
 * @param {string=} namespace 
 * @param {boolean=} autoNamespace 
 * @param {string=} code 
 */
function getI18nJson(map, pathname, namespace, autoNamespace, code) {
  const preName = getNamePre(namespace, pathname, autoNamespace, code)
  const pipeOne = Object.fromEntries(Object.entries(map).map(([key, itemObj]) => [key.split(`${preName}.`)[1], itemObj]))
  const zhObj = getDeepValue(pipeOne, 'zh')
  const zhHantObj = getDeepValue(pipeOne, 'zh-Hant')
  const enObj = getDeepValue(pipeOne, 'en')

  return {
    zhObj,
    zhHantObj,
    enObj
  }
}



/**
 * 把第一个json合并到第二个中
 * @param {Record<string, unknown>} from
 * @param {Record<string, unknown>} to 
 * @param {string} tip 
 */
function mergeJSON(from, to, tip) {
  try {
    Object.keys(from).forEach(fromKey => {
      const fromVal = get(from, fromKey, {})
      const toVal = get(to, fromKey, {})
      const mergeObj = Object.assign(fromVal, toVal)
      !isEmpty(mergeObj) && set(to, fromKey, mergeObj)
    })
    return to
  } catch (error) {
    logError(tip)
    return {}
  }
}

/**
 *获取文件的value值生成新的对象
 *@param {Record<string, Record<string, any>} obj
 *@param {'zh' | 'zh-Hant' | 'en'} valueKey
 */
function getDeepValue(obj, valueKey) {
  return Object.fromEntries(Object.entries(obj).map(([key, itemObj]) => [key, itemObj[valueKey]]))
}

/**
 * 获取中文，中文繁体英文的文件路径
 * @param {string} i18nDir 多语言目录
 * @param {Record<string, string>=} [i18nFileMap={zh: 'zh_CN.json','zh-Hant': 'zh_TW.json',en: 'en.json'}] 多语言目录文件名
 * @returns {DataMap}
 */
function getI18nFilePath(i18nDir, i18nFileMap) {
  if (!isEmpty(i18nFileMap)) {
    return {
      zh: path.resolve(i18nDir, i18nFileMap.zh),
      'zh-Hant': path.resolve(i18nDir, i18nFileMap['zh-Hant']),
      en: path.resolve(i18nDir, i18nFileMap.en)
    }
  }
  const zhPath = [
    path.resolve(i18nDir, 'zh_CN_Config.json'),
    path.resolve(i18nDir, 'zh_CN.json'),
    path.resolve(i18nDir, 'zh.json'),
    path.resolve(i18nDir, 'zh_Config.json'),
    path.resolve(i18nDir, 'zh_config.json'),
    path.resolve(i18nDir, 'zh_CN_config.json'),
  ].find(one => fs.existsSync(one))

  const zhHantPath = [
    path.resolve(i18nDir, 'zh_TW_Config.json'),
    path.resolve(i18nDir, 'zh_TW.json'),
    path.resolve(i18nDir, 'zh_Hant.json'),
  ].find(one => fs.existsSync(one))

  const enPath = [
    path.resolve(i18nDir, 'en_Config.json'),
    path.resolve(i18nDir, 'en.json'),
    path.resolve(i18nDir, 'en_config.json'),
  ].find(one => fs.existsSync(one))

  return {
    zh: zhPath,
    'zh-Hant': zhHantPath,
    en: enPath
  }
}

/**
 * 过滤到文本中的特殊内容
 * @param {string} text 
 * @returns {string}
 */
function replaceText(text) {
  return text.replace(/\n/g, '').trim()
}

/**
 * 代码转换
 * 1.获取没有注释的ast代码
 * 2.找到其中的中文
 * 3.进行上述步骤的替换
 * 4.生成替换中文后的代码
 * @param {string} code 
 * @param {string=} pathname 
 */
function getReplaceCode(code, pathname) {
  try {
    const tplAstZhList = []
    const jsAstZhMap = {}
    const { script: { content: js }, template: { content: tplCode }, styles } = compiler.parseComponent(code)
    const { ast } = compiler.compileTemplate({
      source: `<template>${tplCode}</template>`
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
              const newVal = replaceText(removeQuotes(attr.value))
              attr.value = newVal
              tplAstZhList.push(newVal)
              return attr
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

      genText(node) {
        const { text = '' } = node
        const newText = replaceText(text)
        isTplTextType(text) && tplAstZhList.push(newText)
        node.text = newText
        return newText
      }
    }

    const tplGenerator = new TplGenerator()
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

    if (isEmpty(tplAstZhList) && isEmpty(Object.values(jsAstZhMap))) {
      logError(`${pathname}没有中文`)
      return {}
    }
    const { code: jsCode } = generate(jsAst)
    return {
      tplCode,
      jsCode,
      jsAst,
      tplAst: ast,
      styles,
      tplAstZhList,
      jsAstZhMap,
      code
    }
  } catch (error) {
    return {}
  }
}

/**
 * 检测是否是标签中的纯文本 <p>纯文本</p>
 * @param {string} text 
 * @returns 
 */
function isTplTextType(text) {
  const plaintTxt = text.trim()
  return plaintTxt && !plaintTxt.startsWith('{{') && !plaintTxt.endsWith('}}')
}

/**
 * 获取文件名
 * @param {string} pathname 
 * @param {boolean} [getFullName=false] 
 * @returns 
 */
function getFileName(pathname, getFullName) {
  const name = path.basename(pathname)
  if (getFullName) {
    return name
  }
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

/**
 * 去掉key的开始和结束.
 * @param {string} key 
 */
function trimKey(key) {
  return key.replace(/(\.)/, '').replace(/(\.)$/, '')
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
 * 请求腾讯翻译接口进行翻译
 * @param {string[]} filterList 
 * @param {string} pathname
 * @param {Secret} secret
 * @param {string=} namespace 把翻译的内容放到哪个命名空间里
 * @param {boolean=} autoNamespace 
 * @param {string=} code
 * @returns {TransResult}
 */
async function translateByEngine(filterList, pathname, secret, namespace, autoNamespace, code) {
  if (isEmpty(filterList)) {
    return {
      dataMap: {},
      zhMap: {}
    }
  }
  const res1 = await translate(secret, {
    SourceTextList: filterList,
    Source: 'auto',
    Target: 'en',
    ProjectId: 0
  })
  const enList = res1.TargetTextList.map(trimKey)
  const res2 = await translate(secret, {
    SourceTextList: filterList,
    Source: 'auto',
    Target: 'zh-TW',
    ProjectId: 0
  })
  const TWList = res2.TargetTextList.map(trimKey)
  const namePre = getNamePre(namespace, pathname, autoNamespace, code)
  const dataMap = Object.fromEntries(filterList.map((i, m) => {
    const enName = enList[m]
    const name = sentenceToWord(enName)
    const TWName = TWList[m]
    return [
      `${namePre}.${name}`,
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
      `${namePre}.${name}`,
    ]
  }))
  return {
    dataMap,
    zhMap
  }
}

/**
 * 获取对象的key，插入多语言哪个层级对象内
 * @param {string} namespace 
 * @param {string} pathname 
 * @param {boolean=} [autoNamespace=false] 
 * @param {code=} [code=''] 
 * @returns 
 */
function getNamePre(namespace, pathname, autoNamespace, code) {
  if (autoNamespace && code) {
    return getAutoNamePre(code) || namespace || getFileName(pathname)
  }
  return namespace || getFileName(pathname)
}

/**
 * 根据以及存在的多语言获取命名空间
 * @param {string} code template和js代码
 * @returns {string}
 */
function getAutoNamePre(code) {
  if (!code.match(/(?<="?\$t\()(.)*(?="\))/)) {
    return ''
  }
  const arr = code.match(/(?<="?\$t\()(.)*(?="\))/)[0].replace('"', '').split('.')
  return arr.filter((_, i) => i < arr.length - 1).join('.')
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
  const tpl = addSpaceByLine(tplCode)
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


