const asyncExec = require("./async-exec");

const { logError, logSuccess } = require('./color-log');
const log = require('./log');
const onCopy = require('./on-copy');
const { openUrlInBrowser } = require('./util');

module.exports = async function (translate) {
  const envAuthorKey = process.env.DASHSCOPE_API_KEY;
  if (!envAuthorKey) {
    openUrlInBrowser('https://blog.csdn.net/weixin_40959890/article/details/142098541')
    return log.error('Please set env DASHSCOPE_API_KEY')
  }
  const res = await asyncExec(`curl -X POST "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
--header "Authorization: Bearer $DASHSCOPE_API_KEY" \
--header "Content-Type: application/json" \
--data '{
    "model": "qwen-plus",
    "messages":[
        {
            "role": "system",
            "content": "You are a professional translator."
        },
        {
            "role": "user",
            "content": "翻译${translate}为英文,返回一组的格式为中文:::英文,多组以换行符进行分割"
        }
    ]
}'`)
  let resultStr = ''
  try {
    resultStr = JSON.parse(res).choices[0].message.content
  } catch (error) {
    logError('AIGC翻译失败')
  }
  const resultMap = Object.fromEntries(resultStr.split('\n').map(one => one.split(':::')).filter(([_, en]) => en).map(([zh, en]) => [zh, en.trim()]).map(([zh, en]) => [zh, en.charAt(0).toUpperCase() + en.slice(1)]))
  onCopy(JSON.stringify(resultMap, null, 2))
  logSuccess(JSON.stringify(resultMap, null, 2))
  logSuccess('翻译结果已复制到剪切板')
  return resultMap
}