# 项目格式化，初始化脚手架

# 安装

npm install -g @ajaxlinux/tools

## 使用

```
Usage: tools [options] [command]

Options:
  -h, --help                display help for command

Commands:
  update                    升级应用
  pr                        提pr功能
  version                   应用版本
  help [command]            display help for command
```

## 更新

### 1.0.2 实现 git-pr

- 功能: gitlab 通过 api 提 pr
- 参数：
- 1.token: private_token 请求接口的时候使用
- 2.target: 当前项目.git 目录下的 target 地址|对应的分支
- 第一次设置完之后会把这个信息写到 pr.config.json 中，
- 之后默认从 pr.config.json 中读取这两个信息。
- json 的形式为{
- "target": `${url}|${branch1},${branch2}`
- }
- url 如果省略默认使用.git 目录下的地址
- 3.delete: 讀取 pr.config.json 中的 iid 請求接口進行 close merge request 操作

### 1.0.1

修改包名称

### 1.0.0

初始化
