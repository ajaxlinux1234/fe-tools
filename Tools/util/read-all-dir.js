const fs = require('fs').promises;
const path = require('path');
function asyncReadAllDir(dirPaths, options = { ignore: [] }) {

  if (typeof dirPaths === 'string') {
    dirPaths = [dirPaths];
  }
  // dirPaths 是一个目录路径的数组  
  // 返回一个Promise，该Promise解析为一个包含所有文件和目录信息的数组  
  return Promise.all(dirPaths.map(dirPath => {
    // 为每个目录路径递归地读取文件和子目录  
    return readDirRecursiveForSingleDir(dirPath, options);
  })).then(allResults => {
    // 扁平化所有结果到一个数组  
    return [].concat(...allResults).filter(Boolean);
  });
}

// 辅助函数：递归地读取单个目录中的文件和子目录  
function readDirRecursiveForSingleDir(dirPath, options = { ignore: [] }) {
  return fs.readdir(dirPath, { withFileTypes: true })
    .then(direntS => Promise.all(
      direntS.map(dirent => {
        const fullPath = path.join(dirPath, dirent.name);
        const comparePath = fullPath.split('src')[1]
        const isIgnore = options.ignore.some(one => one.includes(comparePath))
        if (dirent.isDirectory() && !options.ignore.includes(dirent.name) && !isIgnore) {
          // 递归调用并获取目录的结果  
          return readDirRecursiveForSingleDir(fullPath, options)
            .then(subDirResults => subDirResults.map(result => ({
              ...result,
              // 添加路径信息  
              path: fullPath,
              // 如果你想保留原始目录结构，可以去掉这个map  
            })));
        } else if (dirent.isFile() && !options.ignore.includes(dirent.name) && !isIgnore) {
          // 读取文件内容  
          return fs.readFile(fullPath, 'utf8')
            .then(content => ({
              pathname: fullPath, // 文件的完整路径  
              content,
            }));
        }

        // 忽略其他类型的文件系统条目  
        return Promise.resolve(null);
      })
    ))
    .then(results => results.flat()); // 使用flat()来扁平化嵌套的数组  
}

module.exports = {
  asyncReadAllDir,
}