const fs = require('fs');
const path = require('path');
const { createFile } = require('./file');
const cachePath = path.resolve(
  process.cwd(),
  'node_modules',
  '.cache',
  'tools.json'
);
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
    return this.store()[key] || {};
  },
  async set(key, cxt) {
    await createFile(cachePath);
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          ...this.store(),
          [key]: cxt,
        },
        null,
        4
      ),
      'utf-8'
    );
  },
  delete(key) {
    const json = this.store();
    delete json[key];
    fs.writeFileSync(cachePath, JSON.stringify(json, null, 4), 'utf-8');
  },
  clear() {
    fs.writeFileSync(cachePath, '{}', 'utf-8');
  },
};
