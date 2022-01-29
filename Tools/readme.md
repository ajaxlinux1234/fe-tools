# Front-end tools: simplify operation, quality inspection

# Install

npm install -g @ajaxlinux/tools

## use

```
Usage: tools [options] [command]

Options:
  -h, --help display help for command

Commands:
  Generate version.txt in the git-commit-info project
  feishu Feishu related operations
  cp file batch replacement function
  pr mention pr function
  version app version
  update update the application
  help [command] display help for command
```

## Renew

### 1.0.9

#### tools check-ctx

- check keywords in send folder path
- return keyword file path

* .command('check-ctx')
* .description('get keywords file path')
* .option('-P,--path [string]', 'folder path', process.cwd())
* .option('-K,--keywords [string...]', 'keywords string or Regex', [])
* .option('-I,--ignore-path [string]', 'Traverse file ignored paths')

### 1.0.8

change readme language

### 1.0.7

Modify tool title

### 1.0.6

package.json adds keywords

### 1.0.5

#### Modify tools pr

- .description('Merge request')
- .option('-T,--token <string>', 'user token')
- .option('-L,--open-list', '')
- .option('-TA,--target <string>', 'target path and branch')
- .option('-D,--delete', 'delete merge through tool mention')
- .option('-B,--before <string>', 'tools pr hook before execution')
- .option('-A,--after <string>', 'tools pr hook after execution')

#### tools feishu to push messages to Feishu app group after git pr

- .description('Feishu related operations')
- .option('--webhook <string>', 'Send a message to the incoming group bot according to the content of git pr')

#### tools git-commit-info

- .description('Generate git's most recent commitId and time to the file')
- .option('--folder [string]', 'The path to store version.txt', path.resolve(process.cwd(), 'dist', 'version.txt'))

### 1.0.4 Modify readme

### 1.0.3 tools cp (command parameter cache)

- Batch copy files and submit commit
- If it is a compressed file copy to the current project -> decompress the file -> copy the file to the directory to be copied -> delete the zip file and the decompressed file
- Ordinary files or folders do not have the first two steps
- tools cp --path D:\chromeDownload\download.zip --replace src\targetPath1\ public\plugin\targetFile1$pathFile --commit "chore: iconfont content replacement"
- .option('--path <string>', 'compressed zip or normal file path')
- .option('--replace [string...]', 'path or file to replace to$from')
- .option('--commit [string]', 'Description when git commit -m')

### 1.0.2 tools pr

- Function: gitlab provides pr via api
- tools pr --target "http://test|master,dev,dev2" --token "testToken"
- Bring the code to the master, dev, dev2 branches under the current branch
- Parameters:
- .description('Merge request')
- .option('--token <string>', 'user token')
- .option('--target <string>', 'target path and branch')
- .option('--delete', 'Delete merge through tool mention')

### 1.0.1

Modify package name

### 1.0.0

initialization
