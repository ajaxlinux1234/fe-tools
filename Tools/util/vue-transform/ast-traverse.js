function traverseAST(ast, callback) {
  function traverse(node, depth = 0) {
    // 调用回调函数，并将当前节点和深度作为参数传递  
    // 回调函数可以修改node对象  
    callback(node, depth);

    // 遍历当前节点的子节点（如果存在）  
    for (const key in node) {
      if (node.hasOwnProperty(key) && Array.isArray(node[key])) {
        for (let i = 0; i < node[key].length; i++) {
          const childNode = node[key][i];
          if (childNode != null && typeof childNode === 'object') {
            // 递归遍历子节点，并增加深度  
            traverse(childNode, depth + 1);
          }
        }
      }
    }
  }

  // 开始遍历AST的根节点  
  traverse(ast);
}
module.exports = traverseAST