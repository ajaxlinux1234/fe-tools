/**
 * 针对当前要提交的文件或全部的文件，按照传入的规则对文件或文件夹进行遍历，把不符合规则的部分按照
 * title:
 *  fileName | code
 * 打印出来
 */
module.exports = {
  groups: [
    {
      title: '变量的命名方式为小驼峰：首字母小写', // 打印信息时的标题
      /**
       * 
       * @param {*} file 
       * @param {*} fileName 
       * @return {
       *   result: boolean
       *   data: undefined | any
       *   fileName: string
       * }
       * 返回result为false,则当前文件里的内容，或文件夹命名不符合规则。此时把要打印的信息传入data中。返回true则没有问题
       */
      matchFn: (fileCtx, fileName) => {
        const varList = fileCtx.match(/[const|let|var](.*)[;|\S+]/g)
        if (!varList) {
          return { result: true }
        }
        const varNameList = varList.map(i => i.split(' ')[1])
        const bigHumpList = varNameList.filter(word => // 不符合规则的大驼峰列表
          !word.includes('_') &&
          word[0] === word[0].toUpperCase() &&
          word[1] !== word[2].toUpperCase()
        )
        return {
          result: !bigHumpList.length,
          data: bigHumpList,
          fileName
        }
      }
    },
    {
      title: '文件命名单词之间应用-连接',
      matchFn: (_, fileName) => {
        const bigHump = /^([A-Z][a-z]+)$/
        const smallHump = /^[a-z]+([A-Z][a-z]+)$/
        if (bigHump.test(fileName) || smallHump.test(fileName)) {
          return {
            result: false,
            data: fileName
          }
        }
        return { result: false }
      }
    }
  ]
}