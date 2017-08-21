const Promise = require('bluebird')
const Stringify = require('canonical-json')
const fs = Promise.promisifyAll(require('fs'))
const lineByLineReader = require('line-by-line')

const E = require('../lib/error')

/**
 * tweets DB
 */
class Records {

  /**
   * @param {string} filePath - tweetsDB path 
   * @param {string} blackList - filepath of blackList
   */
  constructor(filePath, blackList) {
    this.filePath = filePath
    this.blackList = blackList
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
   * get tweets
   * @param {Object} props
   * @param {number} props.first -optional
   * @param {number} props.last - optional
   * @param {number} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} a collection of tweet objects
   */
  get(props, callback) {
    let { first, last, count, segments } = props
    let records = []
    let lr = new lineByLineReader(this.filePath, {skipEmptyLines: true})

    // read all lines
    lr.on('line', line => records.push(line))

    // check the last line and repair tweets DB if error exists
    lr.on('end', () => {
      // read blackList
      let blackList = fs.readFileSync(this.blackList).toString()
      blackList.length ? blackList = [...new Set(blackList.split(',').map(i => parseInt(i)))]
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
        let result = records.silce(-count)
                            .map(r => JSON.parse(r))
                            .filter(r => !blackList.includes(r.index))
        return callback(null, result)
      }
      else if (first <= last && count && !segments) {
        let tail = records.slice(first - count, first)
        let head = records.slice(last + 1)
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
   * @param {number} props.first -optional
   * @param {number} props.last - optional
   * @param {number} props.count - optional
   * @param {string} props.segments - optional
   * @return {array} each item in array is an tweet object
   */
  async getAsync(props) {
    return Promise.promisify(this.get).bind(this)(props)
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

module.exports = Records