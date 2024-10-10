
const XLSX = require('xlsx');
const onCopy = require('../util/on-copy')
const { logSuccess } = require("../util/color-log");
/**
 * check keywords in send folder path
 * return keyword file path
 * @param {*} program
 */
module.exports = (program) => {
  program
    .command('excelToJson')
    .description('excelToJson')
    .option('--path <string>', 'excelToJson path')
    .action(async (info) => {
      const { path } = info;
      main(path)
    });
};


// 读取 Excel 文件
function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  return sheetNames.map(sheetName => ({
    name: sheetName,
    data: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
  }));
}

// 构建嵌套的 JSON 对象
function buildNestedJson(data) {
  const nestedJson = {};

  data.forEach(sheet => {
    const tableName = sheet.name;
    const tableData = sheet.data;

    tableData.forEach(row => {
      const key = row['Key'];
      const value = row['English'];

      if (!key || !value) return;
      if (!nestedJson[tableName]) {
        nestedJson[tableName] = {}
      }
      toNestedObject(key, value, nestedJson[tableName]);
    });
  });

  return nestedJson;
}

// 将键值对转换为嵌套的 JSON
function toNestedObject(key, value, obj) {
  const keys = key.split('.');
  let currentObj = obj;

  for (let i = 0; i < keys.length; i++) {
    const keyPart = keys[i];

    if (i === keys.length - 1) { // 最后一层，直接赋值
      currentObj[keyPart] = value;
    } else {
      if (!currentObj[keyPart]) {
        currentObj[keyPart] = {};
      }
      currentObj = currentObj[keyPart];
    }
  }
}


// 主函数
async function main(path) {
  const excelData = readExcel(path);
  const nestedJson = buildNestedJson(excelData);
  onCopy(nestedJson)
  logSuccess('json内容复制成功')
}