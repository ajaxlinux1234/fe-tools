const AIGCTranslate = require('../util/AIGCTranslate');
/**
 * AIGC translation
 * @param {*} program 
 */
module.exports = program => {
  program
    .command('AIGCTranslation')
    .description('AIGC translation')
    .option('-T,--translate <string>', 'translating string', '')
    .action(async (info) => {
      await AIGCTranslate(info.translate)
    })
}