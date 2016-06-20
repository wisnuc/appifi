import events from 'events'

class task extends events {

  constructor(type, id, parent) {
    super()
    this.parent = parent
    this.type = type
    this.id = id
    this.status = 'started'
    this.errno = 0
    this.message = null
   
    /** must implement getState() **/
  }

  getState() {
    return {}
  }

  // brilliant name
  facade() {
    return Object.assign({
      type: this.type,
      id: this.id,
      status: this.status,
      errno: this.errno,
      message: this.message,
    }, this.getState())
    
  }
}

export default task
