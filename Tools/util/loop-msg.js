const { isEmpty } = require('lodash');
const { logError } = require('./color-log');
/**
 *
 * @param {*} param Array([[cond, msg]])
 * @returns
 */
module.exports = function (param, isErr) {
  if (!(param instanceof Array)) {
    throw new Error('param must be instanceof Array');
  }
  if (isEmpty(param)) {
    throw new Error('param can not empty');
  }
  const filterItem = param.filter(([bol]) => bol);
  if (isEmpty(filterItem)) {
    return;
  }
  const msgJoin = `\n${filterItem.map(([, msg]) => msg).join('\n')}`;
  if (isErr) {
    throw new Error(msgJoin);
  }
  logError(msgJoin);
  return !!msgJoin;
};
