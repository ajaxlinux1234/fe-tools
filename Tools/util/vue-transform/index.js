const { isEmpty, get, flattenDepth } = require('lodash')
const { isUnaryTag, removeQuotes, isNotEmpty, isBoolean } = require('./utils')
const onCopy = require('../../util/on-copy')
const { DIRECTIVES, TYPE, onReg, preserveBindingReg, customPropertyReg, emptyBaseNodeAttr } = require('./constants')

class TemplateGenerator {
  constructor(options = {}) {
    this.options = options
  }

  generate(ast) {
    const res = {
      code: ''
    }
    if (!ast) {
      return res
    }
    this.ast = ast
    res.code = this.genElement(this.ast)
    return res
  }

  genElement(node) {
    if (!node) {
      return ''
    } else if (node.ifConditions && !node.ifConditionsHasGenerated) {
      return this.genIfConditions(node)
    } else if (node.type === TYPE.ELEMENT) {
      return this.genNode(node)
    } else if (node.type === TYPE.TEXT || node.type === TYPE.STATIC_TEXT) {
      return this.genText(node)
    } else {
      return ''
    }
  }

  genIfConditions(node) {
    node.ifConditionsHasGenerated = true
    if (!node.ifConditions) {
      return ''
    }
    return node.ifConditions
      .map(item => {
        const { block } = item
        return this.genElement(block)
      })
      .filter(isNotEmpty)
      .join('')
  }

  genNode(node) {
    const tag = this.genTag(node)
    const isUnary = isUnaryTag(tag)
    const childrenNodes = this.genChildren(node)

    const directives = [
      this.genVIf(node),
      this.genVFor(node),
      ...this.genEvents(node),
      this.genVShow(node),
      this.genVModel(node),
      this.genVOnce(node),
      this.genVBind(node), // v-bind alias :
      this.genVCloak(node),
      this.genVHtml(node),
      this.genVPre(node),
      this.genVText(node)
    ]

    const attrs = [
      ...this.genAttrs(node),
      this.genStyle(node),
      this.genClass(node),
      // 特殊特性
      this.genKey(node),
      this.genIs(node),
      this.genRef(node),
      this.genSlot(node),
      this.genBind(node)
    ]
    const originProps = [...directives, ...attrs].filter(Boolean)
    if (originProps.some(i => i.includes('only'))) {
      onCopy(node)
    }
    const propsMap = {
      '0': 'genVIf',
      '1': 'genVFor',
      '2': 'genEvents',
      '3': 'genVShow',
      '4': 'genVModel',
      '5': 'genVOnce',
      '6': 'genVBind',
      '7': 'genVCloak',
      '8': 'genVHtml',
      '9': 'genVPre',
      '10': 'genVText',
      '11': 'genAttrs',
      '12': 'genStyle',
      '13': 'genClass',
      '14': 'genKey',
      '15': 'genIs',
      '16': 'genRef',
      '17': 'genSlot',
      '18': 'genBind'
    }
    // const typeMap = Object.fromEntries([...directives, ...attrs].map((i, m) => [propsMap[m], i]))
    // node.propsTypeMap = typeMap
    const props = this.sortProps(originProps, node.attrsMap)
    const startTag = `<${[tag, ...props]
      .filter(isNotEmpty)
      .join(' ')}${isUnary ? '/>' : '>'}`

    const endTag = isUnary ? '' : `</${tag}>`
    return [startTag, childrenNodes, endTag].join('')
  }

  removeKey(name) {
    return name
  }

  sortProps(props, attrsMap) {
    return Object.entries(attrsMap)
      .map(([name]) => props.find(str => this.removeKey(str).trim().startsWith(this.removeKey(name))))
  }

  genChildren(node) {
    if (!node) {
      return ''
    }
    onCopy(node)
    const slotChildren = Object.values(node.scopedSlots || {})
      .map(i => ({
        ...i,
        attrs: Object.entries(i.attrsMap || {}).map(([name, value]) => ({ name, value })),
      }))
    const vElseObj = get(node, 'ifConditions.[1].block') ? get(node, 'ifConditions.[1].block') : {}
    const cmpChild = [...get(node, 'children', []), ...slotChildren]
    if (!isEmpty(vElseObj)) {
      delete node.ifConditions
      node.parent.children.push(vElseObj)
    }
    if (!cmpChild.length) {
      return ''
    }
    return cmpChild
      .map(child => this.genElement(child))
      .filter(isNotEmpty)
      .join('')
  }

  genTag(node) {
    return node.tag
  }

  genText(node) {
    const { text = '' } = node
    return text
  }

  genVIf(node) {
    if (node.if) {
      return `${DIRECTIVES.if}="${node.if}"`
    } else if (node.elseif) {
      return `${DIRECTIVES.elseif}="${node.elseif}"`
    } else if (node.else) {
      return `${DIRECTIVES.else}`
    }
    return ''
  }
  genVFor(node) {
    return this.getDirectiveFromAttrsMap(node, 'for', true)
  }
  genKey(node) {
    return this.getPropFromAttrsMap(node, 'key', true)
  }

  genEvents(node) {
    const { attrsMap = {} } = node
    return Object.keys(attrsMap)
      .map(attr => {
        if (onReg.test(attr)) {
          return `${attr}="${attrsMap[attr]}"`
        }
        return ''
      })
      .filter(isNotEmpty)
  }
  genVShow(node) {
    return this.getDirectiveFromAttrsMap(node, 'show', true)
  }
  genVModel(node) {
    return this.getDirectiveFromAttrsMap(node, 'model', true)
  }
  /**
   *
   * @param node
   * @returns return this props through v-bind or : property operator expect for style/class/type/key
   */
  genVBind(node) {
    const { attrsMap = {} } = node
    return Object.keys(attrsMap)
      .map(attr => {
        const isPreservedProperty = preserveBindingReg.test(attr)
        if (isPreservedProperty) {
          return ''
        }

        const matched = attr.match(customPropertyReg)
        if (matched) {
          return `${matched[0]}=${attrsMap[attr]}`
        }
        return ''
      })
      .filter(isNotEmpty)
      .join(' ')
  }
  /**
   * 提取v-bind属性
   * @param {*} node 
   * @returns 
   */
  genBind(node) {
    const { attrsMap = {} } = node
    return Object.keys(attrsMap)
      .map(attr => {
        const val = (attrsMap[attr] || '').replace(/"'/g, '')
        if (attr === 'v-bind') {
          return `${attr}='${val}'`
        }
        return ''
      })
      .filter(isNotEmpty)
      .join(' ')
  }
  /**
   *
   * @param node
   * @returns return the original html element attrs, like id / placeholder / focus and so on.
   */
  genAttrs(node) {
    const { attrs = [], attrsMap = {} } = node
    if (!attrs.length) {
      return ''
    }
    const attrsMapKeys = Object.keys(attrsMap)

    return attrs
      .map(attr => {
        const { name, value } = attr
        return attrsMapKeys.find(
          attr => `:${name}` === attr || `v-bind:${name}` === attr
        )
          ? ''
          : value === '""'
            ? `${name}=""`
            : `${name}="${removeQuotes(value)}"`
      })
      .filter(isNotEmpty)
  }
  genIs(node) {
    return this.getPropFromAttrsMap(node, 'is', true)
  }
  genStyle(node) {
    const bindStyle = this.getPropFromAttrsMap(node, 'style', true)
    const staticStyle = this.getDomAttrFromAttrsMap(node, 'style', true)
    return `${bindStyle} ${staticStyle}`
  }
  genClass(node) {
    const bindClass = this.getPropFromAttrsMap(node, 'class', true)
    const staticClass = this.getDomAttrFromAttrsMap(node, 'class', true)
    return `${bindClass} ${staticClass}`
  }
  genVOnce(node) {
    return this.getDirectiveFromAttrsMap(node, 'once', true)
  }
  genVPre(node) {
    return this.getDirectiveFromAttrsMap(node, 'pre', true)
  }
  genVCloak(node) {
    return this.getDirectiveFromAttrsMap(node, 'cloak', true)
  }
  genVHtml(node) {
    return this.getDirectiveFromAttrsMap(node, 'html', true)
  }
  genVText(node) {
    return this.getDirectiveFromAttrsMap(node, 'text', true)
  }
  genRef(node) {
    return this.getDomAttrFromAttrsMap(node, 'ref', true)
  }
  genSlot(node) {
    if (node.tag === 'slot') {
      return this.getDomAttrFromAttrsMap(node, 'name', true)
    }
    return ''
  }
  getDirectiveFromAttrsMap(
    node,
    name,
    alias,
    needNormalize
  ) {
    if (isBoolean(alias)) {
      needNormalize = alias
    }
    let res
    const directive = DIRECTIVES[name] || DIRECTIVES[alias]
    const emptyMap = Object.assign({}, emptyBaseNodeAttr)
    const { attrsMap = {} } = node
    if (!directive) {
      res = emptyMap
    } else {
      const dirReg = new RegExp(directive)
      const realDir = Object.keys(attrsMap).find(attr => dirReg.test(attr))
      res = realDir
        ? attrsMap[realDir]
          ? {
            name: realDir,
            value: `"${attrsMap[realDir]}"`
          }
          : Object.assign(emptyMap, {
            noMap: true
          })
        : emptyMap
    }
    return needNormalize ? this.normalizeMap(res) : res
  }
  // TODO:
  getPropFromAttrsMap(node, name, needNormalize) {
    const { attrsMap = {} } = node
    const emptyMap = Object.assign({}, emptyBaseNodeAttr)
    const value =
      attrsMap[`:${name}`] || attrsMap[`${DIRECTIVES.bind}:${name}`]
    let res = !value
      ? emptyMap
      : { name: `:${name}`, value: `"${value}"` }
    return needNormalize ? this.normalizeMap(res) : res
  }
  getDomAttrFromAttrsMap(node, name, needNormalize) {
    const { attrsMap = {} } = node
    const emptyMap = Object.assign({}, emptyBaseNodeAttr)
    let res
    if (attrsMap.hasOwnProperty(name)) {
      res = attrsMap[name] ? { name, value: `"${attrsMap[name]}"` } : emptyMap
    } else {
      res = emptyMap
    }
    return needNormalize ? this.normalizeMap(res) : res
  }
  normalizeMap(res) {
    const { name, value, noMap } = res
    if (noMap && name) {
      return name
    } else if (name && value) {
      return `${name}=${value}`
    } else {
      return ''
    }
  }
}

module.exports = TemplateGenerator
