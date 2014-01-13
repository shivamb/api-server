var async = require('async');
var configs = require('./configs');
var containers = require('./models/containers');
var request = require('request');
var users = require('./models/users');
function onFirstRun (cb) {
  var week = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  var unsavedAndWayExpired = {
    saved: false,
    created: { $lte: week }
  };
  containers.remove(unsavedAndWayExpired, function (err) {
    if (err) {
      return cb(err);
    } else {
      console.log('PURGE VERY EXPIRED DB CONTAINERS');
      return cb();
    }
  });
}
function hasRegisteredOwner (container) {
  return container.ownerJSON && container.ownerJSON.permission_level > 0;
}
function getOwners (domain, containers, cb) {
  var userIds = containers.map(function getOwnerId (container) {
    return container.owner.toString();
  });
  var query = { _id: { $in: userIds } };
  var fields = {
    permission_level: 1,
    _id: 1
  };
  users.find(query, fields, domain.intercept(function attachOwners (users) {
    var userHash = {};
    users.forEach(function (user) {
      userHash[user._id] = user;
    });
    containers.forEach(function (container) {
      container.ownerJSON = userHash[container.owner];
    });
    cb(null, containers);
  }));
}
function cleanupContainersNotIn (domain, whitelist, cb) {
  if (whitelist.length === 0) {
    cb();
  }
  var whiteContainerIds = [];
  var whiteServicesTokens = [];
  whitelist.forEach(function (container) {
    whiteContainerIds.push(container._id);
    whiteServicesTokens.push(container.servicesToken);
  });
  async.parallel([
    function (cb) {
      var notInWhitelist = { _id: { $nin: whiteContainerIds } };
      containers.remove(notInWhitelist, domain.intercept(cb));
    },
    function (cb) {
      request({
        url: configs.harbourmaster + '/containers/cleanup',
        method: 'POST',
        json: whiteServicesTokens,
        pool: false
      }, function (err, res, body) {
        if (err) {
          return domain.emit('error', err);
        } else {
          if (res.statusCode !== 200) {
            return cb({
              status: 502,
              message: 'whitelist not accepted by harbourmaster',
              body: body
            });
          } else {
            return cb();
          }
        }
      });
    }
  ], cb);
}
module.exports = function (req, res) {
  function sendError (err) {
    var status;
    status = err.status;
    delete err.status;
    return res.json(status || 403, err);
  }
  async.series([
    function (cb) {
      if (req.query.firstRun) {
        return onFirstRun(cb);
      } else {
        return cb();
      }
    },
    function (cb) {
      var domain = req.domain;
      users.findUser(domain, { _id: req.user_id }, domain.intercept(function (user) {
        if (!user) {
          return cb({ message: 'permission denied: no user' });
        } else {
          if (!user.isModerator) {
            return cb({ message: 'permission denied' });
          } else {
            containers.listSavedContainers(domain, function (containers) {
              getOwners(domain, containers, function (err) {
                if (err) {
                  return cb(err);
                } else {
                  var validContainers = containers.filter(hasRegisteredOwner);
                  cleanupContainersNotIn(domain, validContainers, cb);
                }
              });
            });
          }
        }
      }));
    }
  ], function (err) {
    if (err) {
      return sendError(err);
    } else {
      return res.json(200, { message: 'successfuly sent prune request to harbourmaster and cleaned mongodb' });
    }
  });
};