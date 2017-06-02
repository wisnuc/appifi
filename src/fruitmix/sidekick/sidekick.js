const child = require('child_process').fork('src/fruitmix/sidekick/cluster')

child.on('message', function(m) {
  // Receive results from child process
  console.log('received: ' + m);
});

// Send child process some work
child.send('Please up-case this string'); 

