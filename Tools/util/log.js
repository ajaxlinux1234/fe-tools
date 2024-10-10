const dayjs = require('dayjs');

module.exports = function (...arg) {
  console.log(
    '\n[tools]',
    `${dayjs().format('YYYYMMDD_hhmmss')}`,
    ...arg.map((i) => {
      if (typeof i === 'object') {
        return i.message || JSON.stringify(i);
      }
      return i;
    })
  );
};
