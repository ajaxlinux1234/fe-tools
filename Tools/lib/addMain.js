const { isEmpty, findLastIndex } = require('lodash');
const readDir = require('../util/read-dir');
const loopMsg = require('../util/loop-msg');
const fs = require('fs');
const { getPathName } = require('../util/file');
/**
 * check keywords in send folder path
 * return keyword file path
 * @param {*} program
 */
module.exports = (program) => {
  program
    .command('addMain')
    .description('add content to main')
    .action(async () => {
      readDir(process.cwd(), {
        onFile: (pathname, { preFile, nextFile }) => {
          if (pathname.includes('main.ts')) {
            const content = fs.readFileSync(pathname, 'utf-8')
            const { name: preName } = getPathName(preFile || '')
            const { name: nextName } = getPathName(nextFile || '')
            const linkFile = preFile ? preName : nextName
            if (content.includes('#index') || content.includes('#cdnVideo')) {
              return
            }
            const contentArr = content.split('\n')
            const lastImportIndex = findLastIndex(contentArr, (item) => item.includes('import'))
            contentArr.splice(lastImportIndex + 1, 0, ...[`import ElementPlus from 'element-plus'`,
              `import ElZhCn from 'element-plus/dist/locale/zh-cn.mjs'`,
              `import ElEn from 'element-plus/dist/locale/en.mjs'`,
              `const currentLocale = queryString.parse(location.search).locale == '0' ? 'zh-CN' : 'en-US'`])

            const lastApp = findLastIndex(contentArr, (item) => item.includes('app'))
            contentArr.splice(lastApp, 0, ...[`const localMap = { 'zh-CN': ElZhCn, 'en-US': ElEn }`, `app.use(ElementPlus, { locale: localMap[currentLocale] })`])
            const fileContent = contentArr.join('\n');
            fs.writeFileSync(pathname, fileContent, 'utf-8')
          }
        },
      });
    });
};