const isNotEmpty = (str) => str !== ''

const isBoolean = (boolean) => typeof boolean === 'boolean'

const removeQuotes = (str = '') => str.replace(/"/g, '')

const makeMap = (string, expectLowerCase) => {
  const map = Object.create(null)
  const list = string.split(',')
  list.map(item => (map[item] = true))

  return expectLowerCase ? val => map[val.toLowerCase()] : val => map[val]
}

const isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
)


module.exports = {
  isNotEmpty,
  isBoolean,
  removeQuotes,
  makeMap,
  isUnaryTag
}
