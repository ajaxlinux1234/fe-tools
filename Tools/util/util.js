const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
const isWin = process.platform.includes('win');
module.exports = {
  sleep,
  isWin,
};
