# 1. Intro
Client、Cloud、Station 三端通信
- [client-cloud api 文档]()
- [station-cloud api 文档]()

# 2. Test Cases
三种形式的测试用例

## 2.1. Command (json)
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
### 2.1.1. 远程获取 token
### 2.1.2. 远程获取 user

## 2.2. WriteDir (formdata)
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
### 2.2.1. 上传单个文件 (< 1GB)
### 2.2.2. 上传单个文件 (> 1GB)
### 2.2.3. 新建文件夹
### 2.2.4. 上传文件夹 (包含多个文件)

## 2.3. 下载文件
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

### 2.3.1. 下载单个文件 (< 1GB)
### 2.3.2. 下载单个文件 (> 1GB)
