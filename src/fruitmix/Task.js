const createTask = require('./xcopy')

class Task {

  constructor () {
    this.tasks = []

    this.nodeApi = {
      PATCH: this.PATCHNODE.bind(this),
      DELETE: this.DELETENODE.bind(this)
    }
  }

  LIST (user, props, callback) {
    this.tasks.filter()
  }

  /**
  
  @param {object} user
  @param {object} props
  */
  POST (user, props, callback) {
    task = createTask(user, props, (err, task) => {
      if (err) return callback(err)
      this.tasks.push(task)
      callback(null, task.view())
    })  
  }  

  DELETE (user, props, callback) {
    let index = this.tasks.findIndex(t => t.user.uuid === user.uuid && t.uuid === taskUUID)
    if (index !== -1) {
      
    }
  }

  PATCHNODE (user, props, callback) {

  }

  DELETENODE (user, props, callback) {
  }

}

module.exports = Task
