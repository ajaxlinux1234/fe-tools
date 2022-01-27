const fs = require('fs');
const { get } = require('lodash');
const path = require('path');
const { createFile } = require('./file');
const { getNameSpace } = require('./util');
const cachePath = path.resolve(
  process.cwd(),
  'node_modules',
  '.cache',
  'tools.json'
);
const nameSpace = getNameSpace();
/**
 * 把命令行执行的结果放到env.tools下面
 */
module.exports = {
  store() {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch (error) {
      return {};
    }
  },
  get(key) {
    return get(this.store(), `${nameSpace}.${key}`, {});
  },
  async set(key, cxt) {
    await createFile(cachePath);
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          ...this.store(),
          [nameSpace]: {
            ...this.store[nameSpace],
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
      const json = this.store();
      delete json[nameSpace][key];
      fs.writeFileSync(cachePath, JSON.stringify(json, null, 4), 'utf-8');
    } catch (error) {
      console.log(error);
    }
  },
  clear() {
    try {
      const json = this.store();
      json[nameSpace] = {};
      fs.writeFileSync(cachePath, JSON.stringify(json, null, 4), 'utf-8');
    } catch (error) {
      console.log(error);
    }
  },
};
