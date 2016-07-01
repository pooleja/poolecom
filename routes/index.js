var express = require('express');
var router = express.Router();

var Server = require('../model/server.js');
var NodeCountStat = require('../model/nodeCountStat.js');

var ReadWriteLock = require('rwlock');
var lock = new ReadWriteLock();

var Env = require('../config/env.js');

/* GET home page. */
router.get('/', function(req, res, next) {

  res.render('index', { title: 'E16'});

});

/* GET map page. */
router.get('/map', function(req, res, next) {

  Server.find({}, function(err, servers) {

   var serverList = [];

   for (var i = 0; i < servers.length; i++) {
     var loc = servers[i].loc;
     var latlong = {};
     latlong['lat'] = loc.split(',')[0];
     latlong['long'] = loc.split(',')[1];
     serverList.push(latlong);
   }

   res.render('map', { title: 'E16 - Locations', key: Env.MAP_API_KEY, navPoints: serverList });

 });
});

/* GET count page. */
router.get('/count', function(req, res, next) {

 NodeCountStat.find({}, 'count', {sort: 'recordDate'}, function(err, stats) {

   console.log(JSON.stringify(stats));
   var data = [];
   for (var i = 0; i < stats.length; i++) {
     data.push(stats[i].count);
   }

   res.render('counts', { title: 'E16 - Counts', data: data });

 });
});

router.post('/upload', function(req, res){

  //console.log(JSON.stringify(req.headers));

  if(req.headers.client != Env.SECRET){
    console.log("Failed client header check");
    return res.json({success: false, error: "Failed client header check"});
  }

  var arrayLength = req.body.pings.length;

  req.body.pings.forEach(function(ping) {
    lock.writeLock(function (release) {

      Server.findOne({ip : ping.server.ip}, function(error, foundServer){

        if(error){
          console.log(error);
          release();
          return res.json({success: false, error: error});
        }

        console.log(JSON.stringify("ping.server: " + JSON.stringify(ping.server)));
        console.log(JSON.stringify("foundServer: " + JSON.stringify(foundServer)));

        if(!foundServer){

          Server(ping.server).save(function(error){
            if(error){
              console.log(error);
              release();
              return res.json({success: false, error: error});
            }

            release();
          });
        }else{
          release();
        }
      });

    });
  });


  // Get the total count of Nodes found to date
  Server.where({}).count(function(error, count){

    if(error){
      console.log("Failed to count nodes: " + error);
      return res.json({success: false, error: error});
    }

    NodeCountStat({count: count}).save(function(error){
      if(error){
        console.log(error);
        return res.json({success: false, error: error});
      }

      console.log("Saved a new record with count: " + count);
      res.json ({success: true});

    });
  });



});

module.exports = router;
