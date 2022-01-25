# 项目格式化，初始化脚手架

# 安装

npm install -g @ajaxlinux/tools

## 使用

```
Usage: tools [options] [command]

Options:
  -h, --help                display help for command

Commands:
  cp                        文件批量替换功能
  pr                        提pr功能
  version                   应用版本
  update                    升级应用
  help [command]            display help for command
```

## 更新

### 1.0.3 实现 tools cp 和命令参数缓存（上次传的参数，下次可省略）

- 批量拷贝文件，并提交 commit
- 如果是压缩文件 copy 到当前项目 -> 解压文件 -> 把文件 copy 到要 copy 的目录 -> 删除 zip 文件和解压之后的文件
- 普通文件或者文件夹没有前两部
- .option('--path <string>', '压缩 zip 或者普通文件路径')
- .option('--replace [string...]', '要替换的路径已经文件')
- .option('--commit [string]', 'git commit -m 时的描述内容')

### 1.0.2 实现 tools pr

- 功能: gitlab 通过 api 提 pr
- 参数：
- .description('Merge request')
- .option('--token <string>', '用户 token')
- .option('--target <string>', '目标路径和分支')
- .option('--delete', '刪除通過工具提的 merge')

### 1.0.1

修改包名称

### 1.0.0

初始化
