class State {
  constructor(ctx, ...args) {
    // 重置CTX状态对象
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  // 设置新态
  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter() {}
  exit() {}
}

class Downloading extends State {

}

class Moving extends State {

}

class Finish extends State {

}

class Task {
  constructor(id, users, name, manager, finishTime) {
    this.id = id // 任务id
    this.users = users
    this.manager = manager // 容器
    this.finishTime = finishTime ? finishTime : null // 任务完成时间
    this.name = name ? name : '' // 任务名称
    this.downloadDir = '' // 下载临时目录
    this.rateDownload = null //下载速率
    this.rateUpload = null // 上传速率
    this.percentDone = 0 // 完成比例
    this.eta = Infinity // 剩余时间
    this.status = null // 当前状态(from transmission)
    new Downloading() // 本地状态(downloading/moving/finish)
  }

  // 与transmission中对应任务进行同步，判断是否完成
  set(task) {
    let { name, downloadDir, rateDownload, rateUpload, percentDone, eta, status } = task
    let nextState = { downloadDir, name, rateDownload, rateUpload, percentDone, eta, status }
    Object.assign(this, nextState)
    if (judeProgress(task))
      process.nextTick(this.manager.addToMoveQueue(this))
  }
  
}

// 判断下载任务是否完成
const judeProgress = (task) => {
  // 本地任务处于移动或完成状态，跳过
  if (this.state !== 'downloading') return
  // 完成条件1 任务标记为完成
  let conditionA = task.isFinished
  // 完成条件2 任务进入了seed状态
  let conditionB = [5, 6].includes(task.status)
  // 完成条件3 任务处于暂停状态、完成度为100%
  let conditionC = task.status == 0 && task.percentDone == 1
  // 进行移动等操作
  if (conditionA || conditionB || conditionC) return true
  else return false
}

