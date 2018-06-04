const child = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const btrfsUsageAsync = require('../system/btrfsusageAsync')
const sysfsNetworkInterfaces = require('../system/networkInterfaces')
const DataStore = require('../lib/DataStore')

/**
K combinator
*/
const K = x => y => x

/**
This function change string format 'processor-family' to js style 'processorFamily'
@param {string} text
@returns camelCased strings.
*/
const camelCase = text =>
  text.split(/[_\- ()]/)
  .map((w, idx) => idx === 0 ?
    w.charAt(0).toLowerCase() + w.slice(1) :
    w.charAt(0).toUpperCase() + w.slice(1))
  .join('')

// parse
const parseSingleSectionOutput = stdout =>
  stdout.toString().split('\n') // split to lines
  .map(l => l.trim()).filter(l => l.length) // trim and remove empty line
  .map(l => l.split(':').map(w => w.trim())) // split to word array (kv)
  .filter(arr => arr.length === 2 && arr[0].length) // filter out non-kv
  .reduce((obj, arr) => K(obj)(obj[camelCase(arr[0])] = arr[1]), {}) // merge into one object

// parse
const parseMultiSectionOutput = stdout =>
  stdout.toString().split('\n\n') // split to sections
  .map(sect => sect.trim()) // trim
  .filter(sect => sect.length) // remove last empty
  .map(sect =>
    sect.split('\n') // process each section
    .map(l => l.trim()).filter(l => l.length) // trim and remove empty line
    .map(l => l.split(':').map(w => w.trim())) // split to word array (kv)
    .filter(arr => arr.length === 2 && arr[0].length) // filter out non-kv
    .reduce((obj, arr) => K(obj)(obj[camelCase(arr[0])] = arr[1]), {})) // merge into one object

/**
Convert proc file system information to JavaScript object

@param {string} path - proc file system path
@param {boolean} multi - if true, treat the output as multiple section
*/
const probeProcAsync = async (path, multi) => {
  let stdout = await child.execAsync(`cat /proc/${path}`)
  return multi ?
    parseMultiSectionOutput(stdout) :
    parseSingleSectionOutput(stdout)
}

const deviceModel = () => {
  return 'PhiNAS2'
}

const softwareVersion = () => {
  return 'v1.0.0'
}

const hardwareVersion = () => {
  return 'v1.0.0'
}

const _device = (() => {
  let sn, key, cert
  try {
    sn = fs.readFileSync('/phi/ssl/deviceSN').toString('utf8').trim()
    key = fs.readFileSync('/phi/ssl/key.pem').toString('utf8')
    cert = fs.readFileSync('/phi/ssl/cert.pem').toString('utf8')
    return {
      sn,
      key,
      cert
    }
  } catch (e) {
    return {
      sn: 'wjagqq9nq6npzw837',
      key: '-----BEGIN PRIVATE KEY-----\r\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCXhb0b0NOLYk4e\r\nj+Ca9JO5mP9hziw/pb9VbvOIGc9YRrY6TPxkpDJyzmA+5LbNY01iDc/5coUe1lbY\r\nzf38ZaExsCCtCUYWqULS75Vq/6+fhrpFhOm9HJZ1l+5/Kif+HyIRYEG08UpoYgEr\r\nrByIVzR0zmj5LBqjJ2LRLmR83aL+W8MiuSNTkh4n6ZdHWPEDx1naKNufrFBK12Dm\r\nr+PMb3UEHqZpG56lFF8S1aO8mM5+UiHmSBEPrQA4SJNCLrzmyTF0GNhstRZhljf7\r\nyvx9OWw30KwwMEx5RQeSlt2f6yJ09iZJoXKmsYyUOGIBnXjbBUnx6DypFyplUAZD\r\ntQpc8uTZAgMBAAECggEAJxWnXypxtu2Hqxh/3liiVmihz4/IGC7f+OCizwOhWWr8\r\nDHPZUviLztNvPinvAXHQ/y8C65xfvEGbq1cPYfCxMMj21MukmanVg+WrDCuiGKs/\r\nFzmetVpPcUvciE7OfB15wzOqH0tyXxSQqrw9q+marVqk90kqIdXCBqVJ5G+jYKrT\r\nJOieiJEq6CFLpfp9WnhFKas0BPuaQHXPiNx8Ikzfp++ED/ZpQBPHAqsP12a5efAq\r\ntInvriiTQeCYNCIOejfVESUxKqhSz95ZnQjUP0+oAy+cDg0bus8wyGYfTJYNok4T\r\nHCXo6mapSWmtqvX2gfS4zQTOTQzHvFs98ig6+b1kAQKBgQDOln0Sr63iEntfWFyN\r\n27xLFmwgVfR4+PZaFUuXx7nW7wqHI4LRGfnlBysdUUT9xSs3EqesxQ0DRLSCToA1\r\nIRoWoV9+q+oj1UVeEqeCsVO4k56r+ZI4+MrxLnVjXqXTNYeoYxd5dws9/sRScCyX\r\nKSgO9W5SSlLz19NzgrBOFrcnWQKBgQC7w46mkpotEnG4UMe6gSNHEaEs3Gse7qh/\r\nCBbxvIU//70nQqbiEgvYypf3dUSg2EMW6ehw47Dpg/0R1ZZ5K3VbxhNIZqbK/ZI7\r\nu0cLIENMaS/gidQJHV0+0LISYBUTCDFWFcVlMxvXClDdwGvoUE598Hky7LRr9iiR\r\nZnFfXqd5gQKBgEin4psU0DnHOD6jLAH0OvfJjgOdV1rIbJPoE2rxImn2LiSzF4oE\r\n8b9b0wz/jR0XIAjBddksgFQa8MU3aJ3G4477+ELroXAyzK+2LdWoGgK7YD2pi4Sf\r\n83f5V+231ug+VlShbRsaBAkstc0siHItVlpUdRVZ8Gy0BjkEyI7eLFIZAoGBAILF\r\nNHj26cIycll4iWJvxm4c7TAdY83rUhcHP1OlhPiJ2OebGDejcfTPRP/oAKA1fqRa\r\nzLSzH+fDMWJWa7KAfgAo+A0Y0VnXOR241UX+dmClcd7kn3SpquOw3hTGLmdO8W2P\r\nRCezbNRcLu4CsiTeqYw1C3RYP2Bh1OdPfe56MhIBAoGAIbwjKO5pykUdynl36XFF\r\n3xfheq1OjNvtssssFsxW4YkWeFiWy4UBkKIuzScR+44snRa8XrTXUv0KcjBRsHNI\r\nFId0k+vI45118M4YZWAF1McEC+fXz4x7QsG0PTqVexP0qkAqQYIJ9ay6KVhhnWwx\r\n7vp2H/QDDf3ub7GYUFvj+mM=\r\n-----END PRIVATE KEY-----\r\n',
      cert: `-----BEGIN CERTIFICATE-----\r\nMIID6jCCAtKgAwIBAgIEKMFDRzANBgkqhkiG9w0BAQsFADCBkzELMAkGA1UEBhMC\r\nQ04xDzANBgNVBAgMBuS4iua1tzEPMA0GA1UEBwwG5LiK5rW3MTMwMQYDVQQKDCrk\r\nuIrmtbfmlpDorq/mlbDmja7pgJrkv6HmioDmnK/mnInpmZDlhazlj7gxEzARBgNV\r\nBAsTClNtYXJ0IERhdGExGDAWBgNVBAMTD3d3dy5waGljb21tLmNvbTAeFw0xODA1\r\nMDgwNTE2MjdaFw0xODA4MDYwNTE2MjdaMIGVMQswCQYDVQQGEwJDTjEPMA0GA1UE\r\nCAwG5LiK5rW3MQ8wDQYDVQQHDAbkuIrmtbcxMzAxBgNVBAoMKuS4iua1t+aWkOiu\r\nr+aVsOaNrumAmuS/oeaKgOacr+aciemZkOWFrOWPuDETMBEGA1UECxMKU21hcnQg\r\nRGF0YTEaMBgGA1UEAxMRd2phZ3FxOW5xNm5wenc4MzcwggEiMA0GCSqGSIb3DQEB\r\nAQUAA4IBDwAwggEKAoIBAQCXhb0b0NOLYk4ej+Ca9JO5mP9hziw/pb9VbvOIGc9Y\r\nRrY6TPxkpDJyzmA+5LbNY01iDc/5coUe1lbYzf38ZaExsCCtCUYWqULS75Vq/6+f\r\nhrpFhOm9HJZ1l+5/Kif+HyIRYEG08UpoYgErrByIVzR0zmj5LBqjJ2LRLmR83aL+\r\nW8MiuSNTkh4n6ZdHWPEDx1naKNufrFBK12Dmr+PMb3UEHqZpG56lFF8S1aO8mM5+\r\nUiHmSBEPrQA4SJNCLrzmyTF0GNhstRZhljf7yvx9OWw30KwwMEx5RQeSlt2f6yJ0\r\n9iZJoXKmsYyUOGIBnXjbBUnx6DypFyplUAZDtQpc8uTZAgMBAAGjQjBAMB8GA1Ud\r\nIwQYMBaAFOv5PMXcycIH8gF3a3yakQyZjgR2MB0GA1UdDgQWBBQUof358lrAPUjL\r\nvczIfSW7cy/6XzANBgkqhkiG9w0BAQsFAAOCAQEAsRURGuF2HMprAT/Ot1DzvlfH\r\nqN3iEBY+eSR2GC0VY7s+E1CybGKOML21PNSOSNXyXUUPVViQ7ntGXdJ0O27iHCdl\r\nbypkgzX5b/y85uxyM3ejYyDe2U1BLyMp8/0tMqdykegL4xdhBEZcAMtRHllQ8yTG\r\nMrPTH0FxqbDIgq/OHkjgzawc43wZzQBBgW4KWnLSTQfNEG24dmLZrfcqZucMDKGo\r\nwUzrQRT2S9wCQ0g0c2N1mMziKS2cdmHBL/f6RW4SweHxEoRDaXoI+02R/6UvTbj1\r\nDXtfJSCnLwSNNv7wTwymyvZkJOpuo4sJOP5T3JXye4chvYEYy8G+sEktR6DKLw==\r\n-----END CERTIFICATE-----\r\n-----BEGIN CERTIFICATE-----\r\nMIIDxzCCAq+gAwIBAgIEE6Pj2jANBgkqhkiG9w0BAQsFADCBkzELMAkGA1UEBhMC\r\nQ04xDzANBgNVBAgMBuS4iua1tzEPMA0GA1UEBwwG5LiK5rW3MTMwMQYDVQQKDCrk\r\nuIrmtbfmlpDorq/mlbDmja7pgJrkv6HmioDmnK/mnInpmZDlhazlj7gxEzARBgNV\r\nBAsTClNtYXJ0IERhdGExGDAWBgNVBAMTD3d3dy5waGljb21tLmNvbTAeFw0xODA1\r\nMDgwNTE1NTNaFw0xOTA1MDgwNTE1NTNaMIGTMQswCQYDVQQGEwJDTjEPMA0GA1UE\r\nCAwG5LiK5rW3MQ8wDQYDVQQHDAbkuIrmtbcxMzAxBgNVBAoMKuS4iua1t+aWkOiu\r\nr+aVsOaNrumAmuS/oeaKgOacr+aciemZkOWFrOWPuDETMBEGA1UECxMKU21hcnQg\r\nRGF0YTEYMBYGA1UEAxMPd3d3LnBoaWNvbW0uY29tMIIBIjANBgkqhkiG9w0BAQEF\r\nAAOCAQ8AMIIBCgKCAQEAx7mQzcj7T2qXZu2DBvHlgfmRNDq2Z7fo15rr9JPdG4bW\r\nV3LWCDmKJPsKlAT+6ri56oiPM2feqowi2QyMevUbAAMaqnRE8oW9JP/FLJvdRFI1\r\nfavEax1iUnoMJJe+SkE/DmFjKxY0PDnjJV/NI6Kb0hFhwA2jTmKR3ve/ro2Aox+m\r\nExrPVllBKpF9A4FWpuo4+/Z9YDluAULQaD3GsOt5wlmo2bYkhvh2otU3Box+uI7+\r\n3vesXJp5rSuHiMmR97+WgLtDXzSSOw+XsUma3y4BBDbBQ5J957sdRbNF0FrJ2hmC\r\niyHabObeCMz32eBxALVV4Mlzp23BOpx1nI+K/WZWUQIDAQABoyEwHzAdBgNVHQ4E\r\nFgQU6/k8xdzJwgfyAXdrfJqRDJmOBHYwDQYJKoZIhvcNAQELBQADggEBAGlF3MTL\r\nbPswzNWyPBTYFz//FKzR7175hpeirOooHgeT+iWSxCyKVusDMIJ8mO6cE3pybhVW\r\nxuK0dkZd422DzkX+Th7fwWH0IBKozxK4pMVXBF+cG8JLXnvHj3Tk6FbdbyC4hEfk\r\nRp9822rYCjgGpk0JUMYUxAroM7NroBz2Hzrpb8lNlY35B0eZNsfLzswF/+CFZxGs\r\nWJbzPFipyYZ7uVWCq9OBIj6Fx+HppPjVRLtkB1M3QRNpUptcVrSPVr412tduFMkM\r\nGevpGIEE7ueqJMKfbW42twNgA2gwCaoBchwy9p5JpjEXOJLbRhbECgAfDVe21yY9\r\nAXuuKN7jumXw0O0=\r\n-----END CERTIFICATE-----\r\n`,
    }
  }
})()

const deviceSN = () => _device.sn
const deviceSecret = () => ({
  key: _device.key,
  cert: _device.cert
})

const networkInterface = () => {
  let interfaces = os.networkInterfaces()

  let keys = Object.keys(interfaces).filter(k => !!k && k !== 'lo')
  if (!keys.length) return

  let key = keys.find(k => Array.isArray(interfaces[k]) && interfaces[k].length)
  if (!key) return
  let ipv4 = interfaces[key].find(x => x.family === 'IPv4')
  return ipv4
}

/**
 * 
 * @module Device
 * 
 */

class Device {
  constructor(ctx) {
    this.ctx = ctx

    let storeFilePath = path.join(ctx.opts.configuration.chassis.dir, 'aliases.json')
    let storeTmpPath = path.join(ctx.opts.configuration.chassis.dTmpDir, 'aliases')
    this.store = new DataStore({
      file: storeFilePath,
      tmpDir: storeTmpPath,
      isArray: true
    })

    this.store.on('Update', (...args) => this.updateAliases(...args))

    Object.defineProperty(this, 'aliases', {
      get() {
        return this.store.data
      }
    })

    this.netdevs = []
    this.startUpdateNetDev()
  }

  startUpdateNetDev() {
    setInterval(() => {
      try {
        let dev = child.execSync(`cat /proc/net/dev | grep enp | awk '{ print  $2 " " $3 " " $10 " " $11 }'`).toString()
        if (dev) dev = dev.split(' ').map(x => x.trim()).filter(x => !!x)
        let speed = {
          receive: {
            bytes: dev[0],
            packets: dev[1]
          },
          transmit: {
            bytes: dev[2],
            packets: dev[3]
          }
        }
        this.netdevs.unshift(speed)
        this.netdevs = this.netdevs.slice(0, 15)
      } catch (e) {}
    }, 1000)
  }

  updateAliases(newData, oldData) {
    this.interfaces((err, its) => {
      if (err) return
      its.forEach(it => {
        if (it.state !== 'up') return
    
        // find out the largest number used
        let num = it.ipAddresses
          .reduce((curr, { number }) => (number ? Math.max(number, curr) : curr), 0) + 1
    
        // bring up all aliases not up
        if (it.config && it.config.aliases) {
          it.config.aliases.forEach((alias) => {
            if (it.ipAddresses.find(ipAddr => ipAddr.address === alias.split('/')[0])) return
    
            child.exec(`ip addr add ${alias} dev ${it.name} label ${it.name}:${num}`)
            num += 1
          })
        }
    
        // shutdown all aliases not in config
        it.ipAddresses.forEach((ipAddr) => {
          if (!ipAddr.number) return
    
          let aliases = it.config && it.config.aliases
          if (!aliases || !aliases.find(alias => alias.split('/')[0] === ipAddr.address)) {
            child.exec(`ip addr del ${ipAddr.address} dev ${it.name}:${ipAddr.number}`)
          }
        })
      })
    })
  }

  cpuInfo() {
    return os.cpus()
  }

  memInfo(callback) {
    probeProcAsync('meminfo', false)
      .then(data => callback(null, data))
      .catch(callback)
  }

  usageInfo(callback) {
    if (this.ctx.fruitmix) {
      btrfsUsageAsync(this.ctx.fruitmix.fruitmixDir)
        .then(data => callback(null, data))
        .catch(callback)
    } else {
      callback(new Error('fruitmix not started'))
    }
  }

  netDev() {
    return this.netdevs
  }

  getAliases() {
    return this.aliases
  }

  addAliases(props, callback) {
    let { name, ipv4, mask } = props
    if (this.aliases.length) return callback(Object.assign(new Error('Only can create one ipaliases, remove it first'), { status: 400 })) 
    this.interfaces((err, its) => {
      if (err) return callback(err)
  
      let it = its.find(i => i.name === name)
      if (!it) return callback(Object.assign(new Error('no interface named ' + name), { status: 404 }))
  
      let cidr = `${ipv4}/${mask}`
      let conf = { name, aliases: [cidr] }
      this.store.save(data => {
        if (data && data.length) throw Object.assign(new Error('Only can create one ipaliases, remove it first'), { status: 400 })
        return [conf]
      }, callback)
    })
  }

  deleteAliases(name, callback) {
    this.store.save(data => {
      if (!Array.isArray(data)) throw Object.assign(new Error('aliase not found'), { status: 404 })
      let index = data.findIndex(d => d.name === name)
      if (index == -1) throw Object.assign(new Error('aliase not found'), { status: 404 })

      return [...data.slice(0, index), ...data.slice(index + 1)]
    }, callback)
  }

  view() {
    return {
      mode: deviceModel(),
      sn: deviceSN(),
      swVersion: softwareVersion(),
      hwVersion: hardwareVersion()
    }
  }

  interfaces(callback) {
    sysfsNetworkInterfaces((err, _its) => {
      if (err) return callback(err)

      // reformat
      const its = _its
        .map(it => ({
          name: it.name,
          address: it.address,
          mtu: it.mtu,
          speed: it.speed,
          wireless: !!it.wireless,
          state: it.operstate,

          // for node address
          ipAddresses: [],

          // for config
          config: null
        }))
        .filter(it => it.state === 'up' || it.state === 'down')

      // annotate ip addresses
      const obj = os.networkInterfaces()

      Object.keys(obj).forEach((key) => {
        if (!key.includes(':')) {
          const it = its.find(i => i.name === key)
          if (it) {
            it.ipAddresses.push(...obj[key])
          }
        } else {
          const split = key.split(':')
          if (split.length !== 2 || split[0].length === 0 || split[1].length === 0) return

          const number = parseInt(split[1], 10)
          if (!Number.isInteger(number) || number < 0 || '' + number !== split[1]) return

          const it = its.find(i => i.name === split[0])
          if (it) {
            const addrs = obj[key]
              .filter(addr => addr.family === 'IPv4')
              .map(addr => Object.assign({
                number
              }, addr))

            it.ipAddresses.push(...addrs)
          }
        }
      })

      // annotate nics
      this.aliases.forEach((config) => {
        const it = its.find(i => i.name === config.name)
        if (it) it.config = config
      })

      callback(null, its)
    })
  }
}

module.exports = Device

/**
 * let total = os.totalmem(), speed, type, free = os.freemem()
      try {
        free = child.execSync('free -b')
          .toString().split('\n')
          .find(x => x.startsWith('Mem:'))
          .split(' ')
          .map(x => x.trim())
          .filter(x => x.length)
          .pop()
        type = child.execSync('dmidecode -t memory |grep -A16 "Memory Device$" |grep "Type: DD*"')
          .toString().split('\n')
          .shift()
          .split(' ')
          .map(x => x.trim())
          .filter(x => x.length)
          .pop()
        speed = child.execSync('dmidecode -t memory |grep -A16 "Memory Device$" |grep "Speed:.*MHz"')
          .toString().split('\n')
          .shift()
          .split(':')
          .pop().trim()
      } catch (e) { }
 */