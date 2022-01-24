const moment = require('moment');

module.exports = function (...arg) {
  console.log(
    '\n[tools]',
    `${moment().format('YYYYMMDD_hhmmss')}`,
    ...arg.map((i) => {
      if (typeof i === 'object') {
        return i.message || JSON.stringify(i);
      }
      return i;
    })
  );
};
