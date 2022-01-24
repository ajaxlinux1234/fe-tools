function getLocalVersion() {
  try {
    const { version } = require('../package.json');
    return version[0] === '^' || version[0] === '~'
      ? version.slice(1)
      : version;
  } catch (error) {
    return '';
  }
}

module.exports = {
  getLocalVersion,
};
