const shelljs = require('shelljs')
module.exports = function (cmd) {
  return new Promise((resolve, reject) =>
    // shelljs.exec(cmd, function (code, stdout, stderr) {
    //   stderr ? reject() : resolve()
    // })
    shelljs.exec(cmd, { async: true })
      .stdout
      .on('data', resolve)
  )
}