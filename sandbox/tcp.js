var net = require('net')
var fs = require('fs')

var server = net.createServer(function(socket) {
  socket.pipe(fs.createWriteStream('received'))
})

server.listen(12345, '127.0.0.1')
