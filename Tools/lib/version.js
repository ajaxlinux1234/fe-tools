module.exports = function (program) {
  program
    .command('version')
    .description('应用版本')
    .action(async () => {
      const version = require('../util/version').getLocalVersion();
      console.log(`应用版本:${version}`);
    });
};
