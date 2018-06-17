Token 用于 Client 访问 NAS.

# 1. Overview
前置条件: 须有本地用户帐号
spec: ?
测例: ?

# 2. APIs
## 2.1. 获取 Token
api:
```
GET /token
```
参数:

```json
{
  "username": "string", // required
  "password": "crypt string", // required
}
```
测例：
-
