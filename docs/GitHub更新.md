# 发布与命令更新

目标公开仓库：Ji-Gang/dustline。

## 玩家

首次从 Releases 下载 DUSTLINE-Windows.zip，完整解压。之后先关闭游戏，在游戏目录的终端运行：

```powershell
.\update.cmd
```

更新器通过 GitHub HTTPS 获取最新正式 Release，仅下载游戏内容包，不重复下载 Electron。它校验 ZIP 和每个文件的 SHA-256，完整解压并校验成功后才替换 resources/app。旧内容保存在 resources/app-backup-*。下载失败不改变已安装游戏。运行环境版本变更时会要求重新下载完整包。

这是“游戏内容包更新”，不是逐字节差分；每次仍会下载当前完整游戏内容和其 JavaScript 依赖。运行环境占据的绝大部分体积不重复传输。公开仓库无需令牌，必须能访问 GitHub。

## 开发者

修改游戏后提升 package.json 和 package-lock.json 的版本，提交并推送 main。GitHub Actions 自动运行测试、构建完整包及内容更新包，然后创建同版本 Release。只有通过测试并发布的版本才会被玩家获取；重复版本号会拒绝发布。

```powershell
npm version patch --no-git-tag-version
git add .
git commit -m "Update game"
git push origin main
```

本地构建：npm ci、npm test、npm run build、powershell -File desktop/release.ps1。

发布物位于 dist/release。首次发布之前，update.cmd 无法从尚不存在的 GitHub Release 下载更新。
