/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   mqtt.js                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: JianJin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/12/07 13:46:13 by JianJin Wu        #+#    #+#             */
/*   Updated: 2017/12/07 17:59:42 by JianJin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const debug = require('debug')('station')
const mqtt = require('mqtt')
const { CONFIG } = require('./const')

module.exports = (stationId) => {
  debug(stationId)
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
  const client = mqtt.connect(CONFIG.MQTT_URL, settings)

  // connect
  client.on('connect', function (connack) {
    debug('station connect successfully!', connack)
    // publish topic
    client.publish(`station/connect`, payload, { qos: 1 })
    // subscribe topic 
    client.subscribe(`station/pipe`, { qos: 1 })
  })

  // message
  client.on('message', function (topic, message, packet) {
    // message is Buffer
    debug(`message`, topic, message, message.toString(), Date.now())
    // client.end()
    // TODO: 
    
  })

  // reconnectregister
  client.on('reconnect', function (err) {
    debug('reconnect', err)
  })

  // close
  client.on('close', function () {
    debug('close')
  })
}