module.exports = function(program) {
    program
        .command('version')
        .description('app version')
        .action(async () => {
            const version = require('../util/version').getLocalVersion();
            console.log(`app version:${version}`);
        });
};