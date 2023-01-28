const fs = require("fs");
const path = require("path");
const isTextFile = /.(json|js|ts|css|less|html|htm|tsx|jsx|htm|sass|svg)$/;

/**
 * 异步遍历文件夹
 * @param {string} dir 在哪个路径
 * @param {object} options
 * @param {string[]|string = [path.resolve(process.cwd(), '.git'), path.resolve(process.cwd(), 'node_modules')]} options.ignorePath 遍历时忽略的路径
 * @param {() => promise | function} options.onDir 遍历到文件夹的回调函数
 * @param {() => promise | function} options.onFile 遍历到文件的回调函数
 * @param {number} level 最多遍历多少层
 * @param {pathname[]} list 编辑的pathname数组
 * @returns 
 */
module.exports = async function readDirFile(dir, options = {}, level, list = []) {
  if (!fs.existsSync(dir)) {
    return list;
  }
  if (typeof level === "number" && level < 0) {
    return list;
  }

  const stat = fs.statSync(dir); // 用来判断是文件还是文件夹
  const files = stat.isDirectory() ? fs.readdirSync(dir) : [""];

  let ignorePath = options.ignorePath || [path.resolve(process.cwd(), '.git'), path.resolve(process.cwd(), 'node_modules')];
  if (typeof ignorePath === "string") {
    ignorePath = ignorePath.split(",");
  }
  ignorePath = ignorePath.filter((i) => i.trim())
    .map(i => i.split(path.sep))
    .map(i => i.join('\/'));
  for (const filename of files) {
    let pathname = path.resolve(dir, filename);
    const stat = fs.statSync(pathname);
    pathname = pathname.split(path.sep).join('\/')
    if (ignorePath.some((i) => pathname.includes(i))) {
      continue;
    }
    if (stat.isDirectory()) {
      const result =
        typeof options.onDir === "function" ? await options.onDir(pathname) : true;
      if (result !== false) {
        readDirFile(
          pathname,
          options,
          typeof level === "number" ? level - 1 : level,
          list
        );
      }
    } else if (stat.isFile()) {
      if (typeof options.onFile === "function") {
        await options.onFile(pathname, {
          isTextFile: !!pathname.match(isTextFile)
        });
      }
      list.push(pathname);
    }
  }
  return;
};