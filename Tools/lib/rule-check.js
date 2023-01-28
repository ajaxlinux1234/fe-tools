
const { RULE_JSON } = require('../util/constants');
const iExec = require('../util/i-exec');
const path = require('path')
const fs = require('fs')
// const { get, isEmpty } = require('lodash');
const { logError } = require('../util/color-log');
const { printTable } = require('console-table-printer');
const eachAsync = require('../util/each-async');
const blackList = ['.json']
/**
 * each folder by rule
 * @param {*} program 
 */
module.exports = program => {
  program
    .command('rule-check')
    .description('each folder by rule and log err info')
    .option('-P,--path [string]', 'folder path', process.cwd())
    .option('-I,--init', 'init rule.json')
    .option('-A,--all', 'if each all folder')
    .action(async (info) => {
      const { path: actionPath, init } = info;
      const configPath = path.resolve(actionPath, RULE_JSON)
      const configExist = fs.existsSync(configPath)
      if (init) {
        if (configExist) {
          return
        }
        return fs.writeFileSync(
          configPath,
          fs.readFileSync(path.resolve(__dirname, '..', 'tpl', 'rule.js'), 'utf-8')
        )
      }

      if (!configExist) {
        return logError('cant find rule.js.make command tools rule-check init to init rule.js')
      }
      const table = []
      const preCommitPaths = iExec('git diff --cached --name-only --diff-filter=ACM')
      const checkPaths = preCommitPaths.split('\n')
        .filter(i => i)
        .filter(i => blackList.every(m => !i.endsWith(m)))
      const { groups: ruleGroup } = require(path.resolve(process.cwd(), 'rule.js'))
      await eachAsync(checkPaths.map(pathStr => async () => {
        const fileName = path.basename(pathStr)
        const fileCtx = fs.readFileSync(path.resolve(process.cwd(), pathStr), 'utf-8')
        eachAsync(
          ruleGroup.map(
            ({ title, matchFn }) => async () => {
              const {
                result,
                data,
                fileName: returnName
              } = await matchFn(fileCtx, fileName)
              if (!result) {
                table.push({
                  index: table.length + 1,
                  title,
                  fileName: returnName,
                  code: JSON.stringify(data)
                })
              }
            }
          ),
          100
        )
      }))
      if (table.length) {
        printTable(table)
      }
    })
}