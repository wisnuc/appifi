# 1. 概述
spec + test plan

[station-api](https://github.com/wisnuc/phi-doc/tree/master/api/station.html)

本地：
- 提供一套可运行的环境, 部署项目步骤
- 补全 spec 对应的 test cases
- 补全 test cases 运行前置条件
- 使用 test cases 步骤


# 2. 资源模块
- *[Token](token.md)
- *[User](user.md)
- *[Drive](drive.md)
- [File](file.md)
- [Tag](tag.md)
- [Media](media.md)

PS: 带 * 符号的优先级高

# 3. 远程调用
[pipe 文档](pipe.md)

# 4. 环境部署
[Windows下源码启动Phi-Bootstrap项目](https://github.com/wisnuc/phi-doc/blob/master/Install-Phi-Bootstrap-in-Windows.md)

# 5. 运行测例
step1 安装依赖包:
```bash
$ npm install
```
step2 运行测例:
```bash
$ npm run mocha phi-test/test/
```
