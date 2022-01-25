const { env } = process;
/**
 * 飞书相关操作
 * 可以在git pr --after钩子函数调用，
 * 在git pr操作完成后用于创建或者更新飞书文档
 * @param {*} program
 */
module.exports = function (program) {
  program
    .command('feishu')
    .description('飞书开发者文档相关操作')
    .option('--create', '飞书文档创建相关参数')
    .option('--update', '飞书文档更新相关参数')
    .option('--delete', '飞书文档删除相关参数')
    .action(async (info) => {});
};
