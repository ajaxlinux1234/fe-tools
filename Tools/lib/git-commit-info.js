const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');

module.exports = function(program) {
    program
        .command('git-commit-info')
        .description('生成git最近的commitId和时间到文件中')
        .option('--folder [string]', '存放version.txt的路径', path.resolve(process.cwd(), 'dist', 'version.txt'))
        .action(async (info) => {
            const { folder: vPath } = info;
            if (!fs.existsSync(vPath)) {
                await shelljs.exec(`touch ${vPath} `, { silent: true })
            }
            const { stdout: time } = await shelljs.exec('git log -1 --format=%cd', { silent: true });
            const { stdout: commitId } = await shelljs.exec('git log --format="%h" -n 1', { silent: true });
            fs.writeFileSync(`${vPath}`, `${time}\n${commitId}`, 'utf-8')
        });
};