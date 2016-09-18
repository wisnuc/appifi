### Precondition:

* Debian 8.3 64bit
* Ubuntu 14.04 64bit

### Ingrediants:

* Node.js
* Git
* MongoDB

### Deploy Node.js

* Download nodejs v5.8.0 source code<p>
`curl https://nodejs.org/dist/v5.8.0/node-v5.8.0.tar.gz -o node-v5.8.0.tar.gz`<p>

* Untar<p>
`tar -zxvf node-v5.8.0.tar.gz -C ./`<p>

* Enter the folder<p>
`cd node-v5.8.0/`<p>

* make & install Node.js to your system<p>

        ./configure
        make
        (sudo) make install
        
### Deploy Git

* Install<p>
`(sudo) apt-get install git`<p>

* Clone this recipes to your own system<p>
`git clone git@github.com:winsuntech/fruitmix.git`<p>

### Deploy MongoDB

* Import the public key used by the package management system<p>
`sudo apt-key adv --keyserver 'keyserver.ubuntu.com' --recv '7F0CEB10'`<p>

* Create a /etc/apt/sources.list.d/mongodb-enterprise.list file for MongoDB<p>
`echo 'deb http://repo.mongodb.org/apt/debian wheezy/mongodb-org/3.2 main' | sudo tee '/etc/apt/sources.list.d/mongodb-org-3.2.list'`<p>

* Reload local package database<p>
`sudo apt-get update`<p>

* Install the MongoDB packages<p>
`sudo apt-get install -y mongodb-org`<p>

### Done
