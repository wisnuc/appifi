/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   mqtt.js                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: JianJin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/12/04 14:15:21 by JianJin Wu        #+#    #+#             */
/*   Updated: 2017/12/05 18:06:43 by JianJin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   station.js                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: JianJin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/12/01 15:14:10 by JianJin Wu        #+#    #+#             */
/*   Updated: 2017/12/01 17:38:12 by JianJin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const debug = require('debug')('mqtt:station')
const mqtt = require('mqtt')

// stationId => clientId 
const stationId = `123123` // TODO:
const clientId = `station_${stationId}` // 'mqttjs_' + Math.random().toString(16).substr(2, 8)

const payload = JSON.stringify({ stationId: stationId })
const settings = {
  clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
  clean: false, // set to false to receive QoS 1 and 2 messages while offline
  will: {
    topic: `station/disconnect`,
    payload: payload, // string or buffer
    qos: 1,
    retain: false
  }
}
// const client = mqtt.connect('mqtt://122.152.206.50:1883', settings)
const client = mqtt.connect('mqtt://localhost:1883', settings)

/**
 * TODO:
 * connect mqtt`s server
 * notes:
 * 1. if it`s first connection, register station info on the cloud, and return stationId.
 * 2. update station online
 * 3. subcribe cloud pipe event
 */
function init() {
  if (!stationId) {
    // register station info 
    stationId = 'xxxxx'
  }
  else {
    // update station online 
    // subcribe cloud pipe event
  }
}

client.on('connect', function (connack) {
  client.publish(`station/connect`, payload, { qos: 1 })
  // sub pipe
  // client.subscribe(`station/pipe`, { qos: 1 })
  debug('station connect successfully!', connack)
})

client.on('message', function (topic, message, packet) {
  // message is Buffer
  debug(`message`, topic, message, message.toString(), Date.now())
  // client.end()
})

// reconnect event
client.on('reconnect', function (err) {
  debug('reconnect', err)
})

// close event
client.on('close', function () {
  debug('close')
})
