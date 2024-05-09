const attribute = (propName, propValue, node, quote = '"') => {
  const loc = 'start' in node ? node : node.loc;
  let start = loc.start.column;
  let offset = loc.start.offset;
  if (!('start' in node)) {
    start += node.tag.length + 2;
    offset += node.tag.length + 2;
  }
  const source = propValue ? `${propName}=${quote}${propValue}${quote}` : propName;
  return {
    type: 6,
    name: propName,
    value: propValue ? {
      type: 2,
      content: propValue,
      loc: {
        start: {
          column: start + propName.length + 2,
          line: loc.start.line,
          offset: offset + propName.length + 2,
        },
        end: {
          column: start + propName.length + 2 + propValue.length,
          line: loc.start.line,
          offset: offset + propName.length + 2 + propValue.length,
        },
        source: propValue
      }
    } : undefined,
    loc: {
      start: {
        line: loc.start.line,
        column: start,
        offset: offset,
      },
      end: {
        line: loc.start.line,
        column: start + source.length,
        offset: offset + source.length,
      },
      source,
    }
  };
};

module.exports = {
  attribute,
};
