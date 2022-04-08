const { logError, logSuccess } = require("../util/color-log");
const shelljs = require('shelljs');
const eachAsync = require("../util/each-async");
const store = require("../util/store");
const { PIPE } = require("../util/constants");
const log = require("../util/log");
const { isEmpty } = require("lodash");
const inquirer = require("inquirer");
/**
 * pipe command
 * @param {*} program 
 */
module.exports = function (program) {
  program
    .command('pipe')
    .option('-N,--name <string>', 'pipe command name')
    .option('-S,--set [string...]', 'cmd string list')
    .option('-L,--list', 'show cmd list')
    .option('-D,--del', 'del cmd list item')
    .action(async (info) => {
      store.setGlobal(true);
      const local = store.get(PIPE);
      const { name, set: sendCmd, list, del } = info;
      const cmdList = sendCmd || local[name];


      if (list) {
        log(Object.keys(store.get(PIPE)));
        store.setGlobal(false);
        return;
      }

      if (!name) {
        if (!isEmpty(local)) {
          const names = Object.keys(local)
          const { name: selName } = await inquirer.prompt([{
            type: "list",
            require: true,
            name: "name",
            choices: names,
            default: names[0]
          }])
          const list = store.get(PIPE)[selName];
          console.log(store.get(PIPE), selName, list);
          await eachAsync(
            list.map(cmd => async () => {
              console.log('cmd', cmd)
              const res = shelljs.exec(cmd, { silent: true })
              console.log(res);
            })
            , 500)
          store.setGlobal(false);
          return;
        }
        store.setGlobal(false);
        return logError('name is required')
      }

      if (name && cmdList) { // store
        await eachAsync(
          cmdList.map(cmd => async () => {
            shelljs.exec(cmd, { silent: true })
          })
          , 500)
        await store.set(PIPE, {
          [name]: cmdList
        })
        store.setGlobal(false);
        return;
      }


      if (del) {
        const data = store.get(PIPE);
        if (!Object.keys(data).includes(del)) {
          store.setGlobal(false);
          return logError('delete name is not correct');
        }
        delete data[del]
        await store.set(PIPE, data);
        store.setGlobal(false);
        logSuccess(`delete ${del} cmd list successfully!`)
      }

    })
}