var fs = require('fs');
var nconf = require('nconf');

function get() {
  if (fs.existsSync('/var/www/.web-dashboard')) {
    nconf.argv().env().file({ file: '/var/www/.web-dashboard'});
  }
  return nconf;
};

module.exports = get();

