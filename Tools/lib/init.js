const inquirer = require("inquirer");
const iExec = require("../util/i-exec");
const path = require('path');
const dayjs = require('dayjs');
const shelljs = require('shelljs');

/**
 * https://www.npmjs.com/package/f2elint
 * @param {*} program 
 */
module.exports = function (program) {
  program
    .command('init')
    .description('init vue or react project with f2elint and webpack config')
    .option('-N,--name <string>', 'project name', dayjs().format('YYYYMMDD_hhmmss'))
    .action(async (info) => {
      const { name } = info;
      const tpl = await inquirer.prompt([{
        type: "list",
        require: true,
        name: "value",
        message: 'Please select the init tpl',
        choices: ['vue2', 'vue3', 'react'],
        default: 'vue2'
      }]);
      const root = path.resolve(__dirname, '../tpl');
      const pathMap = {
        'vue2': path.resolve(root, 'vue2'),
        'vue3': path.resolve(root, 'vue3'),
        'react': path.resolve(root, 'react'),
      }
      const tplPath = pathMap[tpl.value];
      iExec(`cp -r ${tplPath} ${path.resolve(process.cwd())}`);
      iExec(`mv ${tpl.value} ${name}`)
      shelljs.cd(path.resolve(process.cwd(), name))
      iExec(`npm install`, { silent: false });
    })
}