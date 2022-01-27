# 项目格式化，初始化脚手架

# 安装

npm install -g @ajaxlinux/tools

## 使用

```
Usage: tools [options] [command]

Options:
  -h, --help                display help for command

Commands:
  git-commit-info           项目中生成version.txt
  feishu                    飞书相关操作
  cp                        文件批量替换功能
  pr                        提pr功能
  version                   应用版本
  update                    升级应用
  help [command]            display help for command
```

## 更新

### 1.0.5

#### 修改 tools pr

- .description('Merge request')
- .option('-T,--token <string>', '用户 token')
- .option('-L,--open-list', '')
- .option('-TA,--target <string>', '目标路径和分支')
- .option('-D,--delete', '刪除通過工具提的 merge')
- .option('-B,--before <string>', 'tools pr 执行之前的钩子')
- .option('-A,--after <string>', 'tools pr 执行之后的钩子')

#### 增加 tools feishu 在 git pr 之后把消息推送到飞书群组中

- .description('飞书相关操作')
- .option('--webhook <string>', '根据 git pr 的内容，向传入的 group bot 发消息')

#### 增加 tools git-commit-info

- .description('生成 git 最近的 commitId 和时间到文件中')
- .option('--folder [string]', '存放 version.txt 的路径', path.resolve(process.cwd(), 'dist', 'version.txt'))

### 1.0.4 修改 readme

### 1.0.3 实现 tools cp 和命令参数缓存（上次传的参数，下次可省略）

- 批量拷贝文件，并提交 commit
- 如果是压缩文件 copy 到当前项目 -> 解压文件 -> 把文件 copy 到要 copy 的目录 -> 删除 zip 文件和解压之后的文件
- 普通文件或者文件夹没有前两步
- tools cp --path D:\chromeDownload\download.zip --replace src\targetPath1\ public\plugin\targetFile1$pathFile --commit "chore: iconfont 内容替换"
- .option('--path <string>', '压缩 zip 或者普通文件路径')
- .option('--replace [string...]', '要替换的路径或文件 to$from')
- .option('--commit [string]', 'git commit -m 时的描述内容')

### 1.0.2 实现 tools pr

- 功能: gitlab 通过 api 提 pr
- tools pr --target "http://test|master,dev,dev2" --token "testToken"
- 在当前分支下把代码提到 master,dev,dev2 分支
- 参数：
- .description('Merge request')
- .option('--token <string>', '用户 token')
- .option('--target <string>', '目标路径和分支')
- .option('--delete', '刪除通過工具提的 merge')

### 1.0.1

修改包名称

### 1.0.0

初始化
