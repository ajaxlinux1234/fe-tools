const { attribute } = require("./vue3-prop-builder");
const astNodeToString = (_node, _lines, parentRef, options) => {
  const lines = !_lines ? [] : _lines; // TODO: improvement, use array of array of tokens instead of array of lines
  const prepend = options?.prepend || '';
  const index = options?.index || 0;
  let prepended = false;
  const insertAt = (str, where, needSpace = false, lineOverride, columnOverride) => {
    const loc = (_node.type === 11 /* NodeTypes.FOR */ ? _node.codegenNode?.loc || _node.loc : _node.loc)[where];
    const lineNum = Math.max(ref.lastLine, lineOverride === undefined ? loc.line : lineOverride); // Prevent going back to previous lines
    let column = columnOverride || loc.column;
    if (!prepended) {
      str = prepend + str;
      prepended = true;
      column -= prepend.length;
    }
    const splitLines = str.split('\n');
    splitLines.forEach((str, index) => {
      const currentLine = lineNum + index - (where === 'end' ? splitLines.length - 1 : 0);
      let line = lines[currentLine] || '';
      if (index === 0 && where === 'start') {
        line = line.padEnd(column - 1, ' ');
        if (needSpace && line[line.length - 1] !== ' ') {
          line += ' ';
        }
      }
      else if (where === 'end') {
        str = str.padStart(column - 1 - line.length, ' ');
      }
      line += str;
      lines[currentLine] = line;
    });
    if (parentRef) {
      parentRef.lastLine = Math.max(parentRef.lastLine, where === 'end' ? lineNum : lineNum + splitLines.length - 1);
    }
  };
  const insertSource = (loc, fallback = '', needSpace = false) => {
    insertAt(loc.source || fallback, 'start', needSpace, loc.start.line, loc.start.column);
  };
  const insertStart = (str, needSpace = false, lineOverride) => {
    insertAt(str, 'start', needSpace, lineOverride);
  };
  const insertEnd = (str, needSpace = false, lineOverride) => {
    insertAt(str, 'end', needSpace, lineOverride);
  };
  const ref = { lastLine: _node.loc.start.line };
  const insertAfter = (str, lastLine = ref.lastLine) => {
    if (!prepended) {
      str = prepend + str;
      prepended = true;
    }
    let line = lines[lastLine] || '';
    line += str;
    lines[lastLine] = line;
  };
  const closeTag = (node, locOverride) => {
    let column = 0;
    const closeLine = (locOverride?.source || node.loc.source).split('\n').findIndex((source) => (column = source.indexOf('>')) >= 0);
    insertAt('>', 'start', false, (locOverride?.start.line || node.loc.start.line) + closeLine, column + 1);
  };
  switch (_node.type) {
    case 0 /* NodeTypes.ROOT */: {
      const node = _node;
      node.children.forEach((node) => {
        astNodeToString(node, lines);
      });
      insertEnd('');
      break;
    }
    case 1 /* NodeTypes.ELEMENT */: {
      const node = _node;
      insertStart('<' + node.tag);
      if (node.props.length) {
        node.props.forEach((propNode) => {
          astNodeToString(propNode, lines, ref);
        });
      }
      if (node.isSelfClosing) {
        insertEnd('/>');
      }
      else {
        closeTag(node);
        node.children.forEach((node) => {
          astNodeToString(node, lines);
        });
        insertEnd('</' + node.tag + '>');
      }
      break;
    }
    case 3 /* NodeTypes.COMMENT */: {
      const node = _node;
      insertSource(node.loc);
      break;
    }
    case 7 /* NodeTypes.DIRECTIVE */: {
      const node = _node;
      if (node.loc.source) {
        insertStart(node.loc.source, true);
      }
      else {
        if (node.arg) {
          astNodeToString(node.arg, lines, ref);
        }
        if (node.exp) {
          astNodeToString(node.exp, lines, ref, { prepend: node.arg ? '="' : '"', append: '"' });
        }
      }
      break;
    }
    case 16 /* NodeTypes.JS_PROPERTY */: {
      // This should only happen in a v-for
      const node = _node;
      if (!node.key.loc.source) {
        const content = astNodeToString(node.key, undefined, undefined, { prepend: ':' });
        const start = {
          line: node.value.loc.start.line,
          column: node.value.loc.start.column - content.length - 2,
          offset: node.value.loc.start.offset - content.length - 2
        };
        const loc = {
          source: content,
          start,
          end: {
            line: start.line,
            column: start.column + content.length,
            offset: start.offset + content.length,
          }
        };
        astNodeToString({ ...node.key, loc }, lines, ref);
      }
      else {
        astNodeToString(node.key, lines, ref);
      }
      astNodeToString(node.value, lines, ref, { prepend: '="', append: '"' });
      break;
    }
    case 6 /* NodeTypes.ATTRIBUTE */: {
      const node = _node;
      insertStart(node.loc.source || ([node.name, node.value].join('=')), true);
      break;
    }
    case 4 /* NodeTypes.SIMPLE_EXPRESSION */: {
      const node = _node;
      insertSource(node.loc, node.content);
      break;
    }
    case 8 /* NodeTypes.COMPOUND_EXPRESSION */: {
      const node = _node;
      node.children.forEach((child) => {
        if (typeof child === 'symbol') {
          // Not supported
        }
        else if (typeof child === 'string') {
          //insertAfter(child);
          // String is a + operator ignore it
        }
        else {
          astNodeToString(child, lines, ref);
        }
      });
      break;
    }
    case 5 /* NodeTypes.INTERPOLATION */: {
      const node = _node;
      insertSource(node.loc);
      break;
    }
    case 12 /* NodeTypes.TEXT_CALL */: {
      const node = _node;
      //insertStart(node.loc.source);
      astNodeToString(node.content, lines, ref);
      break;
    }
    case 2 /* NodeTypes.TEXT */: {
      const node = _node;
      insertSource(node.loc, node.content);
      break;
    }
    case 9 /* NodeTypes.IF */: {
      const node = _node;
      node.branches.forEach((branch, index) => {
        astNodeToString(branch, lines, ref, { index });
      });
      break;
    }
    case 10 /* NodeTypes.IF_BRANCH */: {
      const node = _node;
      if (node.isTemplateIf) {
        insertStart('<template');
        if (!node.condition) {
          insertStart(' v-else');
        }
        else {
          const quote = node.loc.source[node.condition.loc.start.offset - node.loc.start.offset - 1];
          if (quote !== '"' && quote !== "'") {
            throw new Error('The quote type of your v-if could not be determined, make sure it\'s loc is correct');
          }
          astNodeToString(node.condition, lines, ref, {
            prepend: (index > 0 ? 'v-else-if=' : 'v-if=') + quote,
            append: quote
          });
        }
        closeTag(node);
        node.children.forEach((node) => {
          astNodeToString(node, lines, ref);
        });
        insertEnd('</template>');
      }
      else if (node.children.length === 1) {
        const child = { ...(node.children[0]) };
        if (child.type !== 1 /* NodeTypes.ELEMENT */) {
          throw new Error('Logic exception: A non template v-if cannot be on something else than an element');
        }
        child.props = [
          attribute(node.condition ? (index === 0 ? 'v-if' : 'v-else-if') : 'v-else', node.condition?.loc.source, child),
          ...child.props
        ];
        astNodeToString(child, lines, ref);
      }
      else {
        throw new Error('Logic exception: A non template v-if cannot have multiple children');
      }
      break;
    }
    case 11 /* NodeTypes.FOR */: {
      const node = _node;
      const res = node.loc.source.match(/^v-for\s*=\s*(['"])([\s\S]*)\1$/m);
      if (!res) {
        throw new Error('The v-for source did not match regular expression');
      }
      const content = res[2];
      const isTemplate = node.children.length === 1 && node.codegenNode?.loc.source.startsWith('<template');
      if (!isTemplate) {
        const child = { ...(node.children[0]) };
        if (child.type !== 1 /* NodeTypes.ELEMENT */) {
          throw new Error('Logic exception: A non template v-for cannot be on something else than an element');
        }
        child.props = [
          attribute('v-for', content, node.loc, node.loc.source[6]),
          ...child.props
        ];
        astNodeToString(child, lines, ref);
      }
      else {
        if (node.codegenNode?.loc.start.line) {
          // Fix because the lastLine
          ref.lastLine = node.codegenNode.loc.start.line;
        }
        insertStart('<template', false, node.codegenNode?.loc.start.line);
        insertSource(node.loc);
        const codeGenKey = node.codegenNode?.children.arguments[1].returns;
        if (codeGenKey.props && 'properties' in codeGenKey.props) {
          codeGenKey.props.properties.forEach((node) => {
            astNodeToString(node, lines, ref);
          });
        }
        closeTag(node, node.codegenNode?.loc);
        node.children.forEach((node) => {
          astNodeToString(node, lines, ref);
        });
        insertEnd('</template>');
      }
      break;
    }
    default:
      throw new Error(`The node type ${_node.type} is not implemented, it's not found under normal circumstances in a compiled template, please submit an issue with the AST you are trying to decompile`);
  }
  if (options?.append) {
    insertAfter(options.append);
  }
  if (!_lines) {
    return lines.slice(1).join('\n');
  }
};

module.exports = (ast) => {
  return astNodeToString(ast);
}
