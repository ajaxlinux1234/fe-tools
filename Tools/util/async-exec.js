const shelljs = require('shelljs')
module.exports = function (cmd) {
  return new Promise((resolve, reject) =>
    shelljs.exec(cmd, { async: true, silent: true })
      .stdout
      .on('data', resolve)
  )
}