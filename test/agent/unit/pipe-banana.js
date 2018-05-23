// request cammand

const resource = {
  deviceSN: '1plp0panrup3jqphe',
  data: {
    verb: 'GET',
    urlPath: 'drives/2ea8b46f-cad2-4e44-87d0-b61351e4312e/dirs/2ea8b46f-cad2-4e44-87d0-b61351e4312e/entries/06c10dec-ca66-420a-93fa-2d6ba2986412',
    params: {name: 'loading.gif'}
  }
}

// let resource = new Buffer(data.resource, 'base64').toString('utf8')
const uricomponent = `{"verb":"GET","urlPath":"/drives/ab735921-87e3-45d5-8523-0b16e47b7b72/dirs/ab735921-87e3-45d5-8523-0b16e47b7b72/entries/85df6db2-0bb9-4ff2-a46a-09759933b7ab","params":{ name: 'loading.gif'}}`
