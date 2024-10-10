/** 提取图片中的文本 */
const { logError, logSuccess } = require("../util/color-log");
const shelljs = require('shelljs');
const eachAsync = require("../util/each-async");
const store = require("../util/store");
const { PIPE } = require("../util/constants");
const log = require("../util/log");
const { isEmpty } = require("lodash");
const inquirer = require("inquirer");
const { createWorker } = require('tesseract.js');
const onCopy = require("../util/on-copy");
/**
 * pipe command
 * @param {*} program 
 */
module.exports = function (program) {
  program
    .command('extractTextFromImage')
    .description('extract text from image')
    .option('-P,--path <string>', 'image path')
    .action(async (info) => {
      if (isEmpty(info.path)) {
        return logError('image path is require')
      }
      const worker = await createWorker('eng+chi_sim');
      const ret = await worker.recognize(info.path);
      logSuccess(`已生成内容:\n${ret.data.text}`);
      onCopy(ret.data.text)
      logSuccess('已复制到剪贴板')
      await worker.terminate();
    })
}