process.env['UV_THREADPOOL_SIZE'] = 4

const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const join = name => path.join('tmptest', name)

const createTestFile = () => {
  rimraf.sync('tmptest')
  mkdirp.sync('tmptest')

  for (let i = 0; i < 100000; i++) {
    fs.writeFileSync(join(i.toString()), i)
  }
}

// create test data, a folder contains 100000 files
console.time('createTestFile')
createTestFile()
console.timeEnd('createTestFile')

const testThreadPool = callback => {
  console.time('testThreadPool')
  fs.readdir('tmptest', (err, files) => {
    if (err) return callback(err)
    let result = []
    console.log(files.length)
    files.forEach(f => {
      let fpath = path.join('tmptest', f)
      fs.lstat(fpath, (err, stat) => {
        if (err) return callback(err)
        let obj = {
          size: stat.size,
          mtime: stat.mtime
        }
        result.push(obj)
        if (result.length === 100000) {
          console.timeEnd('testThreadPool')
          rimraf.sync('tmptest')
          callback(result)
        }
      })
    })
  })
}

testThreadPool(result => console.log(result.length))

// threadPool	    4	       8	       16	       32	       64	       128
// 	           572.083	 608.73	  634.244	  610.282	  621.082	  824.756
// 	           563.637 	 593.53	  591.056	  628.94	  630.708	  678.738
// 	           557.877	 623.135	585.058	  603.116	  636.701	  675.697
// 	           561.445	 579.202	612.622	  636.662	  633.046	  618.314
// 	           547.762	 618.406	605.225	  637.148	  619.067	  629.648
// 	           556.558	 601.93	  600.561	  603.351	  662.578	  672.261
// 	           582.495	 609.081	589.647	  602.374	  625.946	  664.728
// 	           573.661	 578.668	590.566	  652.424	  643.859	  625.662
// 	           575.552	 611.272	618.147	  609.661	  606.678	  679.111
// 	           563.14    594.029	644.879	  611.063	  623.991	  638.352
						
// average	   565.421 	601.7983	607.2005	619.5021	630.3656	670.7267


// createTestFiles	      4	          8	         16	         32	         64	       128
// 	                    6885.782	  6669.725	 7283.388 	6915.798	  7171.133  	6519.352
// 	                    6516.889	  6456.718	 6268.74	  6421.062	  7277.959  	6349.441
// 	                    6586.656	  6831.233	 6436.018	  6344.037	  6720.797  	6481.048
// 	                    6687.637	  6887.169	 6429.667	  6704.823	  6796.482  	6654.008
// 	                    6393.459	  6808.362	 6688.208	  6841.899	  6896.417  	6275.061
// 	                    6678.452	  7912.089	 7291.15  	6803.605  	6542.409  	6452.878
// 	                    7071.659	  6753.918	 6419.296	  6616.744	  6234.572  	6393.818
// 	                    6686.375	  6886.811	 6459.677	  6747.613	  6596.086	  7553.657
// 	                    6793.019	  6861.749	 6545.027	  7609.66	    7243.042	  6715.352
// 	                    6716.366	  6985.37	   6576.242 	6619.652	  6343.921	  6673.379
						
// average            	6701.6294	  6905.3144	 6639.7413	6762.4893	  6782.2818	  6606.7994


