const fs = require('fs')
const path = require('path')

const dateFormat = require('dateformat')
const pidusage = require('pidusage')

import createUUIDLog from '../lib/uuidlog'
// const readline = require('readline')

/**
 * this class recode filedata  probe count
 */
class Recorder{
  constructor(dirpath, filedata, delay) {
    this.filedata = filedata
    this.delay = delay || 1000
    this.dirpath = dirpath
    this.logger = createUUIDLog(dirpath)
  }

  start() {
    clearInterval(this.interval)
    this.interval = setInterval(this.recode.bind(this), this.delay)
  }

  // setTimer() {
  //   this.timer = setTimeout(() => {
  //     this.recode()
  //     this.setTimer()
  //   }, this.delay);
  // }

  recode() {
    // time, total, now, cpu usage, memory usage, 
    pidusage.stat(process.pid, (err, stat) => {
      if(err) return 
      let time = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss TT")
      let total = this.filedata.probeTotal
      let now = this.filedata.probeNow
      let cpuUsage = stat.cpu.toFixed(2)
      let memoryUsage = (stat.memory/1024/1024).toFixed(2)
      let text = time + ',' + total + ',' + now + ',' + cpuUsage + '%,' + memoryUsage + 'M'
      this.logger.append('test.csv', text, () => {})
    })
  }
}

export  default Recorder 