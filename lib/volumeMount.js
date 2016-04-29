'use strict'

const fs = require('fs')
const readline = require('readline');

const lineReader = require('readline').createInterface({
  input: require('fs').createReadStream('file.in')
});

const rl = readline.createInterface({
  input: fs.createReadStream(,
});
