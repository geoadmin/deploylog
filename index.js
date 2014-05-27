var es = require('elasticsearch');
var _ = require('underscore');
var clc = require('cli-color');
var moment = require('moment');
var conf = require('./lib/config');
var nosql = require('nosql').load('.data/db.nosql');

var esClient = new es.Client({
  requestTimeout: 300000,
  log: 'info',
  host: 'https://' + conf.get('ES_USERNAME') + ':' + conf.get('ES_PASSWORD') +
        '@' + conf.get('remote_host') + '/elasticsearch'
});

var map = function(doc) {
  return doc;
};

var descsort = function(r1, r2) {
  if (new Date(r1._source['@timestamp']) >
      new Date(r2._source['@timestamp'])) {
      return -1;
  }
  return 1;
};

var ascsort = function(r1, r2) {
  if (new Date(r1._source['@timestamp']) >
      new Date(r2._source['@timestamp'])) {
      return 1;
  }
  return -1;
};

var output = function() { 
  nosql.update();

  var headerLine = function() {
    console.log('When\t\t\tWho\tWhat\t\t\t\t\t\t\tinfo');
  };

  var writeLine = function(date, who, proj, d, i, p, info) {
    var logline = moment(date).format('DD-MM-YYYY HH:mm\t');
    logline += who + '\t';
    logline += proj + '\t';
    logline += (d ? clc.blue('d') : '.');
    logline += '\t\t';
    logline += (i ? clc.yellow('i') : '.');
    logline += '\t\t';
    logline += (p ? clc.red('p') : '.');
    logline += '\t\t';
    logline += info;
    console.log(logline);
  };

  var writeErrorLine = function(line) {
    console.log(line);
  };

  nosql.views.create('sortedasc', map, ascsort, function(count) {
    headerLine();

    nosql.views.all('sortedasc', function(recs, count) {
      var lastDate;
      _.forEach(recs, function(rec) {
        var d, i, p, info = '?', proj, who = '?';
        var msg = rec._source.message;
        var date = new Date(rec._source['@timestamp']);
        //Getting project
        if (msg.match('deploy-database')) {
          proj = 'DB';
        } else if (msg.match('mf-chsdi3')) {
          proj = 'API';
        } else if (msg.match('mf-geoadmin3')) {
          proj = 'MAP';
        } else {
          writeErrorLine(msg);
          throw new Error('could not parse line. No proj found');
        }
        if (msg.match(/db_cluster_all/)) {
        } else {
          //getting stages
          if (msg.match(/cfg prod/) ||
              msg.match(/db_cluster_all/) ||
              msg.match(/db_cluster_p/)) {
            p = true;
          }
          if (msg.match(/cfg int/) ||
              msg.match(/cfg ab/) ||
              msg.match(/db_cluster_all/) ||
              msg.match(/db_cluster_i/) ||
              msg.match(/db_cluster_ab/)) {
            i = true;
          }
          if (msg.match(/cfg dev/) ||
              msg.match(/db_cluster_all/) ||
              msg.match(/db_cluster_t/)) {
            d = true;
          }
          //getting user
          var userMatches = msg.match(/sudo:\s+(\S+)\s+:/);
          if (userMatches && userMatches[1]) {
            who = userMatches[1];
          }
          //getting info
          var infoMatches = msg.match(/--tables=(\S+)\s+/);
          if (infoMatches && infoMatches[1]) {
            info = infoMatches[1];
          } else {
            infoMatches = msg.match(/\/private\/snapshots\/(\S+)/);
            if (infoMatches && infoMatches[1]) {
              info = infoMatches[1];
            }
          }

          if (!d && !i && !p) {
            writeErrorLine(msg);
          } else {
//            if (info = '?') {
//              info = msg;
//            }
            writeLine(date, who, proj, d, i, p, info);
            if (lastDate &&
              date.getDate() != lastDate.getDate()) {
              //headerLine();
            }
          }
        }
        lastDate = date;
      });
    });
  });
};



var updateDB = function() {
  nosql.views.create('sorteddesc', map, descsort, function(count) {
    console.log('created sorted view for nosql db');

    nosql.views.top('sorteddesc', 1, function(mostRecent) {
      var scrolltime = '30s';
      var timeFilter = '';
      var index = '';
      //If we already have records, we applyo
      //- time filter
      //- indices to use in next query
      if (mostRecent &&
          mostRecent[0]) {
        rDate = new Date(mostRecent[0]._source['@timestamp']);
        console.log(mostRecent);
        matches = mostRecent[0]._index.match(/logstash-(\d{4})\.(\d{2})\.(\d{2})/);
        var now = new Date();
        lastIndexDate = new Date(matches[1], matches[2] - 1, matches[3]);
        while (lastIndexDate <= now) {
          if (index != '') {
            index += ', ';
          }
          index += 'logstash-' + lastIndexDate.getFullYear() + '.' + (lastIndexDate.getMonth() + 1) + '.' + lastIndexDate.getDate();
          lastIndexDate.setDate(lastIndexDate.getDate() + 1);
        }
        timeFilter = '+@timestamp:{' + rDate.valueOf() + ' TO ' + Date.now().valueOf() + ']';
      }

      var query = {
        index: index,
        q: '+type:"system" ' +
           '+message:("/var/www/vhosts/mf-chsdi3" OR "/var/www/vhosts/mf-geoadmin3" OR "/home/deploy/deploy-database") ' +
           '+message:"/bin/deploy -r" ' + timeFilter,
        searchType: 'count'
      };

      console.log('Launching query with', query.q);
      console.log('Using indices', query.index);

      //First we see how many results we have
      esClient.search(query, function(error, response) {
        var rawResults = [];
        if (response &&
            response.hits &&
            response.hits.total) {
          query.searchType = undefined;
          query.size = response.hits.total;
          console.log('Searching', query.size, 'results...');
          //Now we get the results
          esClient.search(query, function(err, res) {
            if (res &&
                res.hits &&
                res.hits.hits) {
              console.log('Getting results', res.hits.hits.length);
              res.hits.hits.forEach(function(hit) {
                rawResults.push(hit);
              });

              _.each(rawResults, function(rec) {
                console.log('Inserting into db');
                nosql.insert(rec);
              });

              if (res.hits.total != r.length) {
                console.log('ERROR: Not all results!', res.hits.total);
              } else {
                console.log('all results there', r.length);
              }
            } else {
              console.log('Now New Results found', error);
            }
          });
        } else {
          console.log('No New Results found.');
        }

        output();

      });

    });


  });


};

nosql.on('load', function() {

  updateDB();

});


