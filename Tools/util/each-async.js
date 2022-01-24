const { sleep } = require('./util');

module.exports = async function (asyncFns, time = 0) {
  const list = [];
  for await (const i of asyncFns) {
    try {
      const res = await i();
      await sleep(time);
      list.push(res);
    } catch (error) {
      list.push(error);
    }
  }
  return list;
};
