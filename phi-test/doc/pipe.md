# 1. 概述
Client、Cloud、Station 三端通信，由于远调用涉及到云作为中间层， 故不提供测例.

PS：
- API 在 phi-doc/cloud/ 目录下
- 具体并发数、带宽限制由 phicomm PD 决定.

# 2. 依赖
- 用户已注册并绑定设备

# 3. 请求流程

## 3.1. Command (json)
Client 远程获取 json
```
step 1：
由 Client 发起 Post 请求 Cloud

step 2：
Cloud 通过 pipe 通知 Station

step 3：
Station 接受 pipe message 中的 urlPath、body、服务器地址

step 4：
Station 调用本地 api 得到结果，将结果返回给 Cloud
```
### 3.1.1. 测试
token、boot、device 在远程调用时需要特殊处理：
- 远程获取 token
- 远程获取 boot
- 远程获取 device
- 远程修改 user

## 3.2. WriteDir (formdata)
Client 远程调用 writedir api
```
step 1：
由 Client 发起 Post 请求，以 formdata 形式传输到 Cloud

step 2：
Cloud 通过 pipe 通知 Station

step 3：
Station 接受 pipe 中的服务器地址，发起 Get 请求从 Cloud 获取整个 formdata

step 4：
Station 将从 Cloud 获取到文件流灌入给本地 api

step 5：
上一步成功或失败都须要以 Command 形式反馈给 Cloud
```

### 3.2.1. 测试
- 上传单个文件 (< 2GB)
- 上传文件夹 (包含多个文件)

## 3.3. download
只能单个文件下载
```
step 1：
由 Client 发起 Get 请求 Cloud

step 2：
Cloud 通过 pipe 通知 Station

step 3：
Station 接受 pipe message 中的 urlPath、query、服务器地址

step 4：
Station 调用本地 api 获取到文件流后灌给 Cloud
```

### 3.3.1. 测试
- 下载单个文件 (> 2GB)

# 4. 格式定义
以下格式仅适用于 Cloud 与 Station 之间进行远程访问.

**pipe通道， message 中 data 格式:**
```json
{
    "verb": "GET", // 'GET', 'POST', 'PATCH', 'PUT', 'DELETE'
    "urlPath": "/drives/:driveUUID/dirs/:dirUUID", // router path
    "body": {},    // req.body
    "params": {}   // req.params
}
```
如果 message 中缺少 msgId、 waitingServer、 uid、urlPath 等重要参数， 会提前通过 command 返回 400 错误

**APP通过云服务远程访问NAS设备, command 请求中 body 格式:**
```json
{
  "common": {
    "deviceSN":"设备SN号",
    "msgId":"消息ID"
  },
  "data": {
    "err": {
      "msg": "must be either wildcard or an uuid array", // error message
      "status": 400 // 遵循 http code
    },  // 没有 err 时， err 为 null
    "res": {} // 跟本地调用 api 返回格式一致
  }
}
```

**APP通过云服务远程访问NAS设备, resource 请求中 data 格式:**
```json
{
  "err": {
    "msg": "must be either wildcard or an uuid array", // error message
    "status": 400 // 遵循 http code
  },  // 没有 err 时， err 为 null
  "res": {} // 跟本地调用 api 返回格式一致
}
```
