var fs = require('fs')
var child = require('child_process')

var prufer = require('prufer')

var x = []
for (var i = 0; i < 10; i++) 
  x.push(Math.floor(Math.random() * 10))

var seq = prufer(x)

// write to a graphviz dot file
var out = fs.createWriteStream('random.dot')
out.write('digraph prufer {\n')
seq.forEach(pair => 
  out.write('  ' + pair[0] + ' -> ' + pair[1] + ';\n'))
out.write('}\n')
out.end()
out.on('close', () => 
  child.exec('dot -Tpng random.dot -o random.png', err => {
    console.log('done')
  }))


