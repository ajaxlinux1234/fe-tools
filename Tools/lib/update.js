module.exports = function (program) {
  program
    .command('update')
    .description('升级应用')
    .action(async () => {
      require('../util/check-version')();
    });
};
