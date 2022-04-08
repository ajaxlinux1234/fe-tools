const fs = require('fs');
const { get } = require('lodash');
const { GLOBAL, cachePath } = require('./constants');
const { createFile } = require('./file');
const { getCurBranch } = require('./git-opts');
const { getNameSpace } = require('./util');
/**
 * 把命令行执行的结果放到env.tools下面
 */
module.exports = {
  setGlobal(state) {
    this.isGlobal = state
  },
  nameSpace() { return !this.isGlobal ? `${getNameSpace()}-${getCurBranch()}` : GLOBAL },
  data() {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch (error) {
      return {};
    }
  },
  get(key) {
    return get(this.data(), `${this.nameSpace()}.${key}`, {});
  },
  async set(key, cxt) {
    await createFile(cachePath);
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          ...this.data(),
          [this.nameSpace()]: {
            ...this.data[this.nameSpace()],
            [key]: cxt,
          },
        },
        null,
        4
      ),
      'utf-8'
    );
  },
  delete(key) {
    try {
      const json = this.data();
      delete json[this.nameSpace()][key];
      fs.writeFileSync(cachePath, JSON.stringify(json, null, 4), 'utf-8');
    } catch (error) {
      console.log(error);
    }
  },
  clear() {
    try {
      const json = this.data();
      json[this.nameSpace()] = {};
      fs.writeFileSync(cachePath, JSON.stringify(json, null, 4), 'utf-8');
    } catch (error) {
      console.log(error);
    }
  },
};
