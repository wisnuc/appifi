# 1. Overview
spec + test plan

本地：
- 提供一套可运行的环境, 部署项目步骤
- 补全 spec 对应的 test cases
- 补全 test cases 运行前置条件
- 使用 test cases 步骤

远程：
- 远程调用 api 的前置条件
- pipe 层面返回给云的结果格式说明(以及可能有几种结果)
- test cases(需要跟产品确认并发数以及上传文件数限制)， 主要针对上传这块
- 列出仅在远程或本地使用的 api 以及 test cases

# 2. APIs
api 地址:
[station-api](https://github.com/wisnuc/phi-doc/tree/master/api/station.html)

api 资源模块分类:

- *[Token](token.md)
- *[User](user.md)
- *[Drive](drive.md)
- [File](file.md)
- [Tag](tag.md)
- [Media](media.md)

PS: 带 * 符号的优先级高

# 3. phi-test 交付计划安排

## 3.1. Token
模块名称: Token
完成时间: 2018.6.13 - 2018.6.15

测例定义： [spec_doc](token.md)
测试代码： [test_code](../doc/test/token.js)

## 3.2. User
模块名称: Token
完成时间: 2018.6.13 - 2018.6.15
测例定义： [spec_doc](user.md)
测试代码： [test_code](../doc/test/user.js)

# 4. 远程调用
## 4.1 前提条件
- 用户已注册绑定设备

[pipe](pipe.md)

# 5. 环境部署
[Windows下源码启动Phi-Bootstrap项目](https://github.com/wisnuc/phi-doc/blob/master/Install-Phi-Bootstrap-in-Windows.md)

