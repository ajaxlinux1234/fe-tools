const shelljs = require('shelljs');

module.exports = function exec(command, ...sendArgs) {
  const [first, ...others] = sendArgs;
  const args = [{ silent: true, ...(first || {}) }, ...others];
  if (Array.isArray(command)) {
    const result = [];
    for (let i = 0; i < command.length; i++) {
      result.push(shelljs.exec(command[i], ...args));
    }
    return result;
  } else {
    const result = shelljs.exec(command, ...args);
    const error = result.error || result.stderr || '';
    if (
      typeof error === 'string' &&
      error.trim() &&
      error.toLowerCase().includes('error')
    ) {
      throw new Error(error);
    }
    return result;
  }
}