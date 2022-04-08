function logError(txt) {
  console.log('\033[41;30m X \033[40;31m ' + txt + '\033[0m')
}

function logSuccess(txt) {
  console.log('\033[42;30m √ \033[40;32m ' + txt + '\033[0m')
}

module.exports = {
  logSuccess,
  logError,
}