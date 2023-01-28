const DIRECTIVES = {
  text: 'v-text',
  html: 'v-html',
  show: 'v-show',
  if: 'v-if',
  else: 'v-else',
  elseif: 'v-else-if',
  for: 'v-for',
  on: 'v-on',
  bind: 'v-bind',
  model: 'v-model',
  slot: 'v-slot',
  pre: 'v-pre',
  cloak: 'v-cloak',
  once: 'v-once'
}

const TYPE = {
  ELEMENT: 1,
  TEXT: 2,
  STATIC_TEXT: 3
}

const emptyBaseNodeAttr = {
  name: '',
  value: ''
}

const onReg = /^@|^v-on:/
const preserveBindingReg = /(^:|^v-bind:)(style|class|type|key)/
const customPropertyReg = /(^:|^v-bind:)([\s\S]+)/


module.exports = {
  DIRECTIVES,
  TYPE,
  emptyBaseNodeAttr,
  onReg,
  preserveBindingReg,
  customPropertyReg
}