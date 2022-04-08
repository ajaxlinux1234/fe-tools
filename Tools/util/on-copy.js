// Copy to clipboard in node.js
module.exports = function (text) {
  require("copy-paste").copy(text);
};