const shelljs = require('shelljs');
const log = require('./log');

module.exports = function exec(command, ...args) {
  if (Array.isArray(command)) {
    const result = [];
    for (let i = 0; i < command.length; i++) {
      result.push(shelljs.exec(command[i], ...args));
    }
    return result;
  } else {
    log('[Exec]: ', command, ...args);
    const result = shelljs.exec(command, ...args);
    const error = result.error || result.stderr || '';
    if (
      typeof error === 'string' &&
      error.trim() &&
      error.toLowerCase().includes('error')
    ) {
      log('[ExecError]: ', command, ...args);
      log('[Error]: ', error);
      throw new Error(error);
    }
    return result;
  }
};
