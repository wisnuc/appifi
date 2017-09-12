const app = require('express')()
const request = require('supertest')
const Dicer = require('dicer');
const inspect = require('util').inspect

const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i

app.post('/', function(req, res) {
  var m;
  if (req.method === 'POST'
      && req.headers['content-type']
      && (m = RE_BOUNDARY.exec(req.headers['content-type']))) {
    var d = new Dicer({ boundary: m[1] || m[2] });

    d.on('part', function(p) {
      console.log('New part!');
      p.on('header', function(header) {
        for (var h in header) {
          console.log('Part header: k: ' + inspect(h)
                      + ', v: ' + inspect(header[h]));
        }
      });
      p.on('data', function(data) {
        console.log('Part data: ' + data.length + ' bytes');
      });
      p.on('end', function() {
        console.log('End of part\n');
      });
      p.on('error', err => {
        console.log('part error:', err.message)
      })
    });
    d.on('finish', function() {
      console.log('End of parts');
      res.writeHead(200);
      res.end('Form submission successful!');
    });
    d.on('error', err => {
      console.log('dicer error:', err.message)
    })
    req.pipe(d);
    setImmediate(() => {
      req.unpipe()
      d.end()
    })
  } else if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    res.end(HTML);
  } else {
    res.writeHead(404);
    res.end();
  }
})

request(app)
  .post('/')
  .attach('alonzo.jpg', 'testdata/alonzo_church.jpg')
  .end((err, res) => {
    console.log(err)
  })

