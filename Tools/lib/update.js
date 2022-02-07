module.exports = function (program) {
  program
    .command('update')
    .description('update app')
    .action(async () => {
      require('../util/check-version')();
    });
};