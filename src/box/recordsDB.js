const Promise = require('bluebird')
const Stringify = require('canonical-json')
const fs = Promise.promisifyAll(require('fs'))
const lineByLineReader = require('line-by-line')
const ReadLine = require('readline')

const E = require('../lib/error')
const debug = require('debug')('boxes:recordDB')
/**
 * tweets DB
 */
class RecordsDB {

  /**
   * @param {string} filePath - tweetsDB path 
   * @param {string} blackList - filepath of blackList
   */
  constructor(filePath, blackList) {
    this.filePath = filePath
    this.blackList = blackList
    this.records = []
    this.lock = false
  }

  /**
   * save data to tweets DB
   * @param {Object} obj - object to be stored to tweets DB 
   * @param {number} start - position to start writing data
   * @private
   */
  save(obj, start) {
    let text = Stringify(obj)
    let writeStream = fs.createWriteStream(this.filePath, { flags: 'r+', start: start })
    writeStream.write(`\n${text}`)
    writeStream.close()
  }

  add2(obj, callback) {
    if(this.lock) return callback(new Error('wait for unlock'))
    this.lock = true
    //FIXME: can use after read finished 
    let index = this.records.length + 1
    //TODO: check last line if json parse error

    obj.index = index
    

  }

  /**
   * add new data to tweets DB
   * before adding, check the last record, if incorrect, delete it
   * @param {Object} obj - object to be stored
   */
  add(obj, callback) {
    let records = []
    let lr = new lineByLineReader(this.filePath, {skipEmptyLines: true})

    lr.on('line', line => records.push(line))

    lr.on('end', () => {
      let size = fs.readFileSync(this.filePath).length
      let last = records.pop()

      try {
        let lastObj = JSON.parse(last)
        obj.index = lastObj.index + 1
        this.save(obj, size)
        return callback(null)
      } catch(err) {
        if (err instanceof SyntaxError) {
          let start
          if (last) start = size - last.length - 1
          else start = size - 1

          if (start === -1) {
            obj.index = 0
            fs.truncate(this.filePath, err => {
              if (err) return callback(err)
              let text = Stringify(obj)
              let writeStream = fs.createWriteStream(this.filePath)
              writeStream.write(text)
              writeStream.close()
              return callback(null)
            })
          } else {
            let second = records.pop()
            obj.index = JSON.parse(second).index + 1
            fs.truncate(this.filePath, start, err => {
              if (err) return callback(err)
              this.save(obj, start)
              return callback(null)
            })
          }
        } else return callback(err)
      }     
    }) 
  }

  /**
   * async edition of add
   * @param {Object} obj - object to be stored
   */
  async addAsync(obj) {
    return await Promise.promisify(this.add).bind(this)(obj)
  }

  /**
   * @param {Function} callback - records lines size
   */
  read(callback) {
    let lr = new lineByLineReader(this.filePath, { skipEmptyLines: true })
    let error, records = [], files = new Set()
    // read all lines record lines size
    lr.on('line', line => {
      if(error) return
      try {
        let Line = JSON.parse(line)
        // if (Line.type === 'blob') files.add(l.id)
        if (Line.type === 'list') Line.list.forEach(l => files.add(l.sha256))
        records.push(new Buffer(line).length)
      } catch(e) {
        if (e instanceof SyntaxError) { // only last line
          // TODO: check is last line
          this.fixLine(line, (err, isDel) => {
            if(err) {
              error = err
              lr.close()
              return callback(err)
            } 
          })
        }else {
          error = e
          lr.close()
          return callback(e) 
        }
      }
    })

    // check the last line and repair tweets DB if error exists
    lr.on('end', () => {
      if(error) return
      this.records = records // FIXME: ????
      return callback(null, [...files])
    })

    lr.on('error', err => {
      if(error) return
      error = err
      debug(err)
      return callback(error)
    })
  }

  // delete last line if error
  /**
   * @param {Buffer} line - last line in db
   * @param {Function} callback - error, isDelete 
   */
  fixLine(line, callback) {
    try {
      JSON.parse(line)
      process.nextTick(() => callback(null, NO))
    } catch(e) {
      if (e instanceof SyntaxError) {
        fs.readFile(this.filePath, (err, data) => {
          let size = data.length
          let start
          if (line) start = size - new Buffer(line).length - 1
          else start = size - 1
          start = (start === -1) ? 0 : start
          fs.truncate(this.filePath, start, err => {
            if (err) return callback(err)
            return callback(null, YES)
          })
        })
      } else return callback(e)
    }
  }

  /**
   * get tweets
   * first, last, count are not transfered to number
   * in order to distinguish 'undefined' and 0
   * @param {Object} props
   * @param {string} props.first -optional, when transfered to number, it is an integer larger than -1
   * @param {string} props.last - optional
   * @param {string} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} a collection of tweet objects
   */
  get(props, callback) {
    let { first, last, count, segments } = props
    let records = []
    let lr = new lineByLineReader(this.filePath, {skipEmptyLines: true})

    // read all lines
    lr.on('line', line => records.push(line))

    lr.on('error', err => {
      debug(err)
      callback(err)
    })

    // check the last line and repair tweets DB if error exists
    lr.on('end', () => {
      // read blackList
      let blackList = fs.readFileSync(this.blackList).toString()
      blackList.length ? blackList = [...new Set(blackList.split(',').filter(x => x.length).map(i => parseInt(i)))]
                       : blackList = []

      // repair wrong content and filter contents in blackList
      let size = fs.readFileSync(this.filePath).length
      let end = records.pop()

      try {
        JSON.parse(end)
        records.push(end)
      } catch(e) {
        if (e instanceof SyntaxError) {
          let start
          if (end) start = size - end.length - 1
          else start = size - 1

          start = (start === -1) ? 0 : start
          fs.truncate(this.filePath, start, err => {
            if (err) return callback(err)
          })
        } else return callback(e)
      }

      if (!first && !last && !count && !segments) {
        let result = records.map(r => JSON.parse(r))
                            .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (!first && !last && count && !segments) {
        if (count === '0') return callback(null, [])
        let result = records.slice(-count)
                            .map(r => JSON.parse(r))
                            .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (first <= last && count && !segments) {
        let tail = records.slice(Math.max(0, first - count), first)
        let head = records.slice(Number(last) + 1)
        let result = [...tail, ...head]
                    .map(r => JSON.parse(r))
                    .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (!first && !last && !count && segments) {
        segments = segments.split('|').map(i => i.split(':'))
        let result = []
        segments.forEach(s => {
          s.length === 2
          ? result.push(...records.slice(Number(s[0]), Number(s[1]) + 1))
          : result.push(...records.slice(Number(s[0])))
        })

        result = result.map(r => JSON.parse(r)).filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else
        return callback(new E.EINVAL())
    })
  }
  
  /**
   * async edition of get
   * @param {Object} props 
   * @param {string} props.first -optional
   * @param {string} props.last - optional
   * @param {string} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} each item in array is an tweet object
   */
  async getAsync(props) {
    return Promise.promisify(this.get).bind(this)(props)
  }

  getLastTweet(callback) {
    let records = []
    let lr = new lineByLineReader(this.filePath, {skipEmptyLines: true})

    // read all lines
    lr.on('line', line => records.push(line))

    // check the last line and repair tweets DB if error exists
    lr.on('end', () => {
      // read blackList
      let blackList = fs.readFileSync(this.blackList).toString()
      blackList.length ? blackList = [...new Set(blackList.split(',').filter(x => x.length).map(i => parseInt(i)))]
                       : blackList = []

      // repair wrong content and filter contents in blackList
      let size = fs.readFileSync(this.filePath).length
      let end = records.pop()
      if(!end) return callback()
      try {
        JSON.parse(end)
        records.push(end)
      } catch(e) {
        return callback(e)
      }

      blackList.forEach(index => records = [...records.slice(0, index),...records.slice(index+1)])
      if(records.length)
        return callback(null, JSON.parse(records.pop()))
      return callback(null)
    })
  }

  /**
   * delete tweets
   * it's not delete the content in tweetsDB, but add the index into blackList
   * @param {array} indexArr - index array of tweets to be deleted
   */
  delete(indexArr, callback) {
    indexArr = [...new Set(indexArr)].toString()
    let size = fs.readFileSync(this.blackList).length
    let writeStream = fs.createWriteStream(this.blackList, { flags: 'r+', start: size })
    size ? writeStream.write(`,${indexArr}`) : writeStream.write(`${indexArr}`)
    writeStream.close()
    return callback(null)
  }

  /**
   * async detition of delete
   * @param {array} indexArr - index array of tweets to be deleted
   */
  async deleteAsync(indexArr) {
    return Promise.promisify(this.delete).bind(this)(indexArr)
  }
}

module.exports = RecordsDB