/** 通过正则对中文内容进行替换 */
const fs = require('fs')
const path = require('path')

const shelljs = require('shelljs')

const tencentcloud = require("tencentcloud-sdk-nodejs");
const TmtClient = tencentcloud.tmt.v20180321.Client;

const parser = require("@babel/parser");
const { default: traverse } = require("@babel/traverse");
const { default: generate } = require("@babel/generator");
const compiler = require("@vue/compiler-sfc")
const { pick, isEmpty, get, set, findLastIndex, cloneDeep } = require('lodash')

const uuid = require('uuid');

const { logError, logSuccess } = require('../util/color-log');
const store = require('../util/store');
const { TRANSLATE } = require('../util/constants');
const { sleep } = require('../util/util');
const onCopy = require('../util/on-copy')
const { checkFileExists, createFile } = require('../util/file');
const { asyncReadAllDir } = require('../util/read-all-dir');
const vue3AstToTpl = require('../util/vue-transform/vue3-ast-template');
const traverseAST = require('../util/vue-transform/ast-traverse');
const format = require('prettier-eslint');


const zhReg = /[\u4E00-\u9FA5]+/g

const zhGroupReg = /(?:'(?=[\u4e00-\u9fa5])[\u4e00-\u9fa5\u0041-\u005a\u0061-\u007a']*')|(?=[\u4e00-\u9fa5])[\u4e00-\u9fa5\u0041-\u005a\u0061-\u007a]+/g

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
    .command('translate-vue3')
    .description('translate vue3 project')
    .option('-P,--path [string...]', '翻译目录路径或文件路径', [process.cwd()])
    .option('-ID,--secretId [string]', '腾讯翻译secretId', '')
    .option('-KEY,--secretKey [string]', '腾讯翻译secretKey', '')
    .option('-RE,--region [string]', '腾讯翻译注册区域', '')
    .option('-N,--namespace [string]', '命令空间', '')
    .option('-AUTO,--autoNamespace [boolean]', '是否启用自动获取命令空间', '')
    .option('-W,--white [string]', '要翻译哪些后缀名的文件', '.vue')
    .option('-R,--retranslate', '是否把翻译后的文案转成中文重新翻译')
    .option('-I18N,--i18nDir [string]', '翻译后多语言文件目录', path.resolve(process.cwd(), 'public', 'static', 'i18n', 'locales'))
    .option('-I18NF,--i18nFileMap', '翻译后多语言文件文件名', { zh: 'zh_CN.json', 'zh-Hant': 'zh_TW.json', en: 'en.json' })
    .action(async (info) => {
      const transConfigPath = path.resolve(process.cwd(), 'translate.config.js')
      const packageJson = require(path.resolve(process.cwd(), 'package.json'))
      const translateConfig = fs.existsSync(transConfigPath) ? require(transConfigPath) : null
      const vueVersion = get(packageJson, 'dependencies.vue', '')

      const vueStableVersion = vueVersion[0] === "^" || vueVersion[0] === "~" ?
        vueVersion.slice(1) :
        vueVersion

      const isVue3 = vueStableVersion.startsWith('3')
      const { secretId, secretKey, region, path: originPath, white, i18nDir, i18nFileMap, namespace, autoNamespace, i18nUseName, i18nImportStr, scriptFirst, customTranslate, retranslate } = translateConfig || info
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
      if ((!id || !key || !cmpRegin) && !customTranslate) {
        return logError('腾讯翻译开发者secretId和secretKey和腾讯云注册区域必传')
      }
      const whiteList = white.split(',')

      /**
       * 操作主函数
       * @param {string} pathname 
       * @param {string=} [sendContent='']
       * @returns 
       */
      async function main(pathname, sendContent) {
        const notTranslateFile = whiteList.every(suffix => !pathname.endsWith(suffix))
        if (notTranslateFile) {
          return {}
        }
        const ctx = sendContent
        const res = getReplaceCode(ctx, pathname, isVue3)
        return res
      }
      let zhObj = {}
      let zhHantObj = {}
      let enObj = {}
      let willTranslateList = []
      const jsAstZhMapUnion = {}

      let fileContent = await asyncReadAllDir(pathAlias, { ignore: ['.git', 'node_modules', 'dist'] });


      fileContent = fileContent.filter(one =>
        Boolean(one.content) &&
        !one.content.includes('defineComponent') &&
        !allChineseComment(one.content, one.pathname)
      )

      for await (const { pathname, content } of fileContent) {
        let newCode = ''
        if (retranslate) {
          newCode = await new Retranslate().getInstance({
            ctx: content,
            translateConfig,
            pathname
          })
        }
        const res = await main(pathname, newCode || content)
        if (!isEmpty(res)) {
          const { zhList = [] } = res
          willTranslateList.push(...zhList)
          jsAstZhMapUnion[pathname] = {
            ...res
          }
        }
      }
      willTranslateList = Array.from(new Set(willTranslateList))
      const secretParams = {
        secretId: id,
        secretKey: key,
        region: cmpRegin
      }
      const common = 'common'
      logWrapper.fileName = getFileName(common, true)
      logWrapper(customTranslate ? '使用自定义翻译引擎开始翻译替换中文' : '开始翻译替换中文')
      /** 替换template中文 */
      const { zhMap, dataMap } = await translateByEngine(willTranslateList, common, secretParams, namespace, autoNamespace, '', customTranslate, retranslate)
      for (pathname in jsAstZhMapUnion) {
        const { tplAst, jsAst, jsAstZhMap, code, jsCode, styles } = jsAstZhMapUnion[pathname]

        traverseAST(tplAst, (node) => {
          const valOne = get(node, 'value.content', '')
          const valTwo = get(node, 'children.content', '')
          const val = valOne || valTwo
          const source = get(node, 'loc.source')
          const sourceList = getAstZhList(source)
          if (!val && !isEmpty(sourceList) && typeof source === 'string') {
            set(node, 'loc.source', source.split('\n').map(
              one => one.replace(/[\u4E00-\u9FA5]+/g, zh => `{{${i18nUseName}('${zhMap[zh]}')}}`)
            ).join('\n'))
            return
          }
          if (!val) {
            return
          }
          if (!/[\u4E00-\u9FA5]+/g.test(val)) {
            return
          }
          if (valOne) {
            const fullValOne = get(node, 'loc.source')
            if (typeof fullValOne === 'string') {
              let replaceValOne = fullValOne.startsWith(':') ?
                fullValOne :
                `:${fullValOne}`
              replaceValOne = replaceValOne.replace(valOne, (value) => `${i18nUseName}('${zhMap[value]}')`)
              set(node, 'loc.source', replaceValOne)
            }
          }
          if (valTwo) {
            const replaceValTwo = `{{${i18nUseName}('${zhMap[valTwo]}')}}`
            set(node, 'children.loc.source', replaceValTwo)
          }
        })

        const newTpl = vue3AstToTpl(tplAst)

        /** 替换js中文 */
        let newJs = jsCode;
        const jsZhList = Object.values(jsAstZhMap)
        if (!isEmpty(jsAst) && !isEmpty(jsZhList)) {
          traverse(jsAst, {
            enter(path) {
              let val = ''
              if (typeof path.node.value === 'string') {
                val = path.node.value
              } else if (get(path, 'node.value.raw')) {
                val = get(path, 'node.value.raw')
              }
              const { start, end } = path.node
              if (!val) {
                return
              }
              if (!/[\u4E00-\u9FA5]+/g.test(val)) {
                return
              }
              const zh = jsAstZhMap[`${start}_${end}`]
              path.node.extra.raw = `${i18nUseName}('${zhMap[zh]}')`
            }
          })
          newJs = generate(jsAst).code
        }

        const finalJs = mergeI18nImport(newJs, i18nImportStr)
        let newCode = getNewCode(newTpl, finalJs, styles, code, scriptFirst)
        const { hasPrettierConfig, prettierConfigPath } = getPrettierConfig()
        fs.writeFileSync(pathname, newCode, 'utf-8')
        if (hasPrettierConfig) {
          shelljs.exec(`npx prettier --config ${prettierConfigPath} --write ${pathname}`, { silent: true })
        } else {
          shelljs.exec(`npx prettier --write ${pathname}`, { silent: true })
        }
        await sleep(500)
        logWrapper.fileName = getFileName(pathname, true)
        logWrapper('写入成功')

      }

      const { zhObj: zhObjOne, zhHantObj: zhHantObjOne, enObj: enObjOne } = getI18nJson(dataMap, '', namespace, autoNamespace, '')

      const preName = common
      zhObj[preName] = zhObjOne
      zhHantObj[preName] = zhHantObjOne
      enObj[preName] = enObjOne

      if (isEmpty(Object.values(zhObj)[0])) {
        return logWrapper('没有内容需要被写入到多语言配置文件')
      }
      logWrapper('开始写入多语言配置文件')
      const { zh: zhPath, en: enPath, 'zh-Hant': zhHantPath } = await getI18nFilePath(i18nDir, i18nFileMap)

      let zhJSON, zhHantJSON, enJSON

      try {
        zhJSON = require(zhPath)
      } catch (error) {
        zhJSON = {}
      }

      try {
        zhHantJSON = require(zhHantPath)
      } catch (error) {
        zhHantJSON = {}
      }

      try {
        enJSON = require(enPath)
      } catch (error) {
        enJSON = {}
      }

      const zh = mergeJSON(zhObj, zhJSON, '中文翻译json文件写入失败')
      const zhHant = mergeJSON(zhHantObj, zhHantJSON, '中文繁体翻译json文件写入失败')
      const en = mergeJSON(enObj, enJSON, '英文翻译json文件写入失败')
      checkFileExists(zhPath) && fs.writeFileSync(zhPath, JSON.stringify(zh, null, 2), 'utf-8')
      checkFileExists(zhHantPath) && fs.writeFileSync(zhHantPath, JSON.stringify(zhHant, null, 2), 'utf-8')
      checkFileExists(enPath) && fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf-8')
      logWrapper('写入多语言配置文件成功')
    })
}

function getPrettierConfig() {
  const prettierConfigPath = path.resolve(process.cwd(), '.prettierrc.json')
  const hasPrettierConfig = checkFileExists(prettierConfigPath)
  return {
    hasPrettierConfig,
    prettierConfigPath
  }
}

/**
 * 
 * @param {string} str 
 */
function logWrapper(str) {
  logSuccess(`文件${logWrapper.fileName}: ${str}`)
}

/** 首字母转为大写 */
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 页面template中的中文全是注释
 */
function allChineseComment(content, pathname) {
  if (!content) {
    return false
  }
  const ctx = content
    .split('\n')
    .filter(one =>
      !one.includes('<!--') &&
      !one.includes('-->') &&
      !one.includes("//")
    ).join('\n')
  return !zhGroupReg.test(ctx)
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
  let enObj = getDeepValue(pipeOne, 'en')

  if (enObj) {
    enObj = Object.fromEntries(Object.entries(enObj).map(([key, value]) => [key, capitalizeFirstLetter(value)]))
  }
  return {
    zhObj,
    zhHantObj,
    enObj
  }
}


/**
 * 合并import语句到代码中
 * @template T
 * @param {T} code 
 * @param {(T) => false | T} i18nImportStr 
 * @returns {T}
 */
function mergeI18nImport(code, i18nImportStr) {
  const i18nImport = i18nImportStr(code);
  if (!i18nImport) {
    return code
  }
  const codeSplit = code.split('\n')
  const lastImportIndex = findLastIndex(codeSplit, item => item.includes('import '))

  codeSplit.splice(lastImportIndex + 1, 0, i18nImport)
  return codeSplit.join('\n')
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
async function getI18nFilePath(i18nDir, i18nFileMap) {
  if (typeof i18nDir === 'object') {
    const list = Object.values(i18nDir)
    for await (one of list) {
      await createFile(one)
      logSuccess(`文件${one}创建成功`)
    }
    return i18nDir
  }
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
 * 获取模板的AST中不能解析的中文内容
 * @param {*} source 
 */
function getAstZhList(source) {
  if (!source || typeof source !== 'string') {
    return source
  }
  return source.split('\n')
    .filter(one => /[\u4E00-\u9FA5]+/g.test(one))
    .map(one => one.replace(/[\t|'|\s]/g, ''))
    .filter(one => /^[\u4e00-\u9fff]+$/.test(one))
}

/**
 * 代码转换
 * 1.获取没有注释的ast代码
 * 2.找到其中的中文
 * 3.进行上述步骤的替换
 * 4.生成替换中文后的代码
 * @param {string} code 
 * @param {string=} pathname 
 * @param {boolean} isVue3 
 */
function getReplaceCode(code, pathname, isVue3) {
  try {
    const jsAstZhMap = {}
    const source = compiler.parse(code)
    const { script, scriptSetup, styles, filename } = source.descriptor
    const tplCode = get(source.descriptor, 'template.content', '')
    const js = (scriptSetup ? (scriptSetup || {}).content : (script || {}).content) || ''
    const { ast } = compiler.compileTemplate({
      source: `<template>${tplCode}</template>`,
      id: uuid.v1(),
      filename
    })
    const jsAst = js ? parser.parse(js, {
      plugins: ["jsx", "typescript"],
      sourceType: "module",
    }) : {}

    const tplAstZhList = []

    traverseAST(ast, (node) => {
      let val = get(node, 'value.content', '') || get(node, 'children.content', '')
      const sourceList = getAstZhList(get(node, 'loc.source'))
      if (!val && !isEmpty(sourceList)) {
        tplAstZhList.push(...sourceList)
      }
      if (!val) {
        return
      }
      if (!/[\u4E00-\u9FA5]+/g.test(val)) {
        return
      }
      if (get(node, 'value.content', '')) {
        tplAstZhList.push(node.value.content)
      }
      if (get(node, 'children.content', '')) {
        tplAstZhList.push(node.children.content)
      }
    })
    if (!isEmpty(jsAst)) {
      traverse(jsAst, {
        enter(path) {
          let val = ''
          if (typeof path.node.value === 'string') {
            val = path.node.value
          } else if (get(path, 'node.value.raw')) {
            val = get(path, 'node.value.raw')
          }
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
    }
    const jsAstZhList = Object.values(jsAstZhMap)
    const zhList = Array.from(new Set([...tplAstZhList, ...jsAstZhList]))
    if (isEmpty(zhList)) {
      logError(`${pathname}没有中文`)
      return {}
    }
    let jsCode = ''
    if (!isEmpty(jsAst)) {
      jsCode = generate(jsAst).code
    }
    return {
      tplCode,
      jsCode,
      jsAst,
      tplAst: ast,
      styles,
      tplAstZhList,
      jsAstZhList,
      zhList,
      jsAstZhMap,
      code
    }
  } catch (error) {
    console.log('compiler.parse:', error)
    return {}
  }
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
 * @param {boolean=} [isFullName=false] 是否需要完整的名称
 * @returns {string}
 */
function sentenceToWord(enName, isFullName) {
  if (!enName) {
    return enName
  }
  const arr = enName
    .replace('，', ' ')
    .replace(',', ' ')
    .replace(/\n,!\?/g, '')
    // .replace(/[\p{P}\p{S} \u3000-\u303F\uFF01-\uFF5E\n\r]+/gu, '')
    .split(' ')
  const enNameArr = arr
    .filter((_, m) => isFullName ? true : m === 0 || m === arr.length - 1)
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

function filterTag(name) {
  return !name.includes('</') && !name.includes('/>') && !name.includes('<') && !name.includes('>')
}

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
async function translateByEngine(oList, pathname, secret, namespace, autoNamespace, code, customTranslate) {
  const filterList = oList.filter(filterTag)
  if (customTranslate) {
    const res = await customTranslate(filterList)
    if (!get(res, 'dataMap') || !get(res, 'zhMap')) {
      logError('customTranslate must return {dataMap, zhMap}')
    }
    return res
  }
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

  dataMap = Object.fromEntries(filterList.map((i, m) => {
    const enName = enList[m]
    const name = sentenceToWord(enName, true)
    const TWName = TWList[m]
    return [
      `${namePre}.${name}`.replace(/'/g, ''),
      {
        zh: i.replace(/'/g, ''),
        en: enName.replace(/'/g, ''),
        "zh-Hant": TWName.replace(/'/g, '')
      }
    ]
  }))
  zhMap = Object.fromEntries(filterList.map((i, m) => {
    const name = sentenceToWord(enList[m], true)
    return [
      i,
      `${namePre}.${name}`.replace(/'/g, ''),
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
 * @param {string} source
 * @param {boolean} scriptFirst
 * @returns {string}
 */
function getNewCode(tplCode, jsCode, styles, source, scriptFirst) {
  const tpl = addSpaceByLine(tplCode)
  const scriptType = source.split('\n').find(one => one.includes('<script'))
  const js = `
  ${scriptType}
    ${addSpaceByLine(jsCode, 2, 0)}
  </script>\n`
  const styleStr = styles.map((i, m) => {
    const style = i.attrs.scoped ?
      `<style scoped lang="${i.attrs.lang}">${addSpaceByLine(get(i, 'content', ''))}</style>\n` :
      i.attrs.lang ?
        `<style lang="${i.attrs.lang}">${addSpaceByLine(get(i, 'content', ''))}</style>\n` :
        `<style>${addSpaceByLine(get(i, 'content', ''))}</style>\n`;
    return style
  }).join('')
  const newCode = scriptFirst ? `${js}${tpl}${styleStr}` : `${tpl}${js}${styleStr} `
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
  const spaceCode = codeArr.map((i, m) => `${noSpaceIndex === m ? '' : spaceStr}${i} `).join('\n')
  return spaceCode
}

/**
 * @typedef {Object} TranslateConfig
 * @property {{zh: string, en: string}} i18nDir 项目i18n中英文目录
 * @property {boolean} scriptFirst 组合的时候script在最上面
 */

/**
 * @typedef {Object} RetranslateOptions
 * @property {string} [ctx] 文件内容
 * @property {TranslateConfig} translateConfig 文件配置
 * @property {string} pathname 文件路径
 */

/**
 * 把翻译后的改成中文, 以便后续重新翻译
 */
class Retranslate {
  async getInstance(options) {
    if (!Retranslate.instance) {
      Retranslate.instance = new Retranslate(options)
    }
    const newCode = await Retranslate.instance.replaceI18nToZh()
    return newCode
  }
  /**
   * 构造函数
   * @param {RetranslateOptions} options 
   */
  constructor(options) {
    this.options = options
  }

  /**
 * 检查给定的字符串是否包含 i18n 翻译函数调用
 * 该函数使用正则表达式来匹配 't(' 或 '$t(' 开头，后跟任意字符，再以 ')' 结尾的模式
 * @param {string} str - 要检查的字符串
 * @returns {boolean} - 如果字符串包含 i18n 翻译函数调用，则返回 true，否则返回 false
 */
  containsI18nTranslation(str) {
    // 正则表达式模式，匹配 't(' 或 '$t(' 开头，后跟任意字符，再以 ')' 结尾
    const regex = /t\(['"](.*?)['"]\)|$t\(['"](.*?)['"]\)/;

    // 使用 test 方法检查字符串是否匹配正则表达式
    return regex.test(str);
  }

  translateI18nToZh(str) {
    const translationMap = this.getTranslateMap()
    const regex = /\{\{ t\('([^']*)'\) \}\}/gm;
    const lineRegex = /t\(['"](.*?)['"]\)/gm

    const hasTernaryOperator = str.includes('?') && str.includes(':')
    const oStr = str.replace(regex, (match, key) => {
      return hasTernaryOperator ? `"${get(translationMap, `zh.${key}`) || match}"` : get(translationMap, `zh.${key}`) || match;
    })
    const replaceStr = hasTernaryOperator ? oStr : oStr.replace(/:/gm, '')

    return str.includes('t(') ?
      replaceStr
        .replace(lineRegex, (match, key) => {
          return hasTernaryOperator ? `"${get(translationMap, `zh.${key}`) || match}"` : get(translationMap, `zh.${key}`) || match;
        }) :
      str;
  }

  getTranslateMap() {
    const { zh: zhDir, en: enDir } = this.options.translateConfig.i18nDir
    return {
      zh: JSON.parse(fs.readFileSync(zhDir, 'utf8')),
      en: JSON.parse(fs.readFileSync(enDir, 'utf8'))
    }
  }

  async replaceI18nToZh() {
    const _this = this
    const source = compiler.parse(this.options.ctx)
    const { script, scriptSetup, filename, styles } = source.descriptor
    const tplCode = get(source.descriptor, 'template.content', '')
    const js = (scriptSetup ? (scriptSetup || {}).content : (script || {}).content) || ''
    const { ast } = compiler.compileTemplate({
      source: `<template>${tplCode}</template>`,
      id: uuid.v1(),
      filename
    })
    const jsAst = js ? parser.parse(js, {
      plugins: ["jsx", "typescript"],
      sourceType: "module",
    }) : {}

    traverseAST(ast, (node) => {
      if (this.containsI18nTranslation(get(node, 'exp.loc.source', '')) && node.rawName) {
        set(node, 'rawName', node.rawName.replace(':', ''))
        set(node, 'exp.loc.source', this.translateI18nToZh(get(node, 'exp.loc.source', '')))
      }
      if (get(node, 'loc.source', '')) {
        set(node, 'loc.source', this.translateI18nToZh(get(node, 'loc.source', '')))
      }
    })
    const newTpl = vue3AstToTpl(ast)
    if (!isEmpty(jsAst)) {
      traverse(jsAst, {
        enter(path) {
          let val = ''
          if (typeof path.node.value === 'string') {
            val = path.node.value
          } else if (get(path, 'node.value.raw')) {
            val = get(path, 'node.value.raw')
          }

          if (!val) {
            return
          }
          if (!val.includes('common.')) {
            return
          }
          const zhMap = _this.getTranslateMap().zh
          path.node.extra.raw = `'${get(zhMap, val, val)}'`

          if (path.node.name === 't') {
            path.node.name = ''
          } else if (get(path, 'node.value.name') === 't') {
            path.node.value.name = ''
          }
        }
      })
    }
    const newJs = this.getReplaceJSCtx(generate(jsAst).code)
    const newCode = getNewCode(newTpl, newJs, styles, this.options.ctx, this.options.translateConfig.scriptFirst)
    // await this.writeFile(newCode)
    logSuccess(`${this.options.pathname}已提取翻译前的文案内容`)
    return newCode
  }

  getReplaceJSCtx(str) {
    return str.replace(/(?<![a-zA-Z])\bt\('([^']*)'\)/g, function replaceT(_, p1) {
      return `'${p1}'`;
    })
  }

  async writeFile(newCode) {
    const pathname = this.options.pathname
    fs.writeFileSync(pathname, newCode, 'utf-8')
    const { hasPrettierConfig, prettierConfigPath } = getPrettierConfig()
    if (hasPrettierConfig) {
      shelljs.exec(`npx prettier --config ${prettierConfigPath} --write ${pathname}`, { silent: true })
    } else {
      shelljs.exec(`npx prettier --write ${pathname}`, { silent: true })
    }
    await sleep(500)
    logSuccess(`${pathname}写入翻译前的文案内容`)
  }
}


