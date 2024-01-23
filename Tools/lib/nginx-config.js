const fs = require('fs')
const shelljs = require('shelljs')
const { logError, logSuccess } = require('../util/color-log');
const { NG } = require('../util/constants');
const iExec = require('../util/i-exec');
const store = require('../util/store');
const onCopy = require('../util/on-copy')
/**
 * 替换nginx地址并重启nginx
 * @param {*} program 
 */
module.exports = program => {
  program
    .command('ng')
    .description('replace nginx content address && restart nginx')
    .option('-P,--path <string>', 'nginx path', '')
    .option('-U,--url <string>', 'replace path', '')
    .option('-R,--regExp <string>', 'replace regExp', '')
    .option('-I,--info', 'cat nginx config info')
    .option('-GP,--getPath', 'get nginx config path')
    .action(async (info) => {
      if (info.getPath) {
        const ngConfig = iExec(`brew info nginx`)
        const configPath = ngConfig.match(/(?<=in\s+)(.)*(?=\s+to)/g)[0]
        logSuccess(`nginx config path:${configPath}`)
        onCopy(configPath)
        return
      }
      if (info.info) {
        const ngConfig = iExec(`brew info nginx`)
        const configPath = ngConfig.match(/(?<=in\s+)(.)*(?=\s+to)/g)[0]
        iExec(`cat ${configPath}`, { silent: false })
        return
      }
      store.setGlobal(true)
      const local = store.get(NG)
      let { path = local.path, url, regExp = local.regExp } = info;
      if (!path) {
        path = '/opt/homebrew/etc/nginx/nginx.conf'
      }
      if (!regExp) {
        regExp = '(?<=proxy_pass)(.)*'
      }
      if (!url) {
        store.setGlobal(false);
        return logError('url is required')
      }
      store.set(NG, {
        path,
        regExp
      })
      const nginxConfig = fs.readFileSync(path, 'utf-8')
      const originMatchUrl = nginxConfig.match(new RegExp(regExp, 'g'))[0]
      const originUrl = new URL(originMatchUrl).origin
      const newConfig = nginxConfig.replace(new RegExp(originUrl, 'g'), url)
      fs.writeFileSync(path, newConfig, 'utf-8')
      logSuccess('写入新配置文件成功')
      iExec('nginx -s reload')
      logSuccess('重启nginx成功')
    })
}