var categories, channels, configs, domains, error, express;
configs = require('../configs');
categories = require('../models/categories');
channels = require('../models/channels');
domains = require('../domains');
error = require('../error');
express = require('express');
module.exports = function (parentDomain) {
  var app;
  app = module.exports = express();
  app.use(domains(parentDomain));
  app.post('/channels', function (req, res) {
    return channels.createChannel(req.domain, req.user_id, req.body.name, req.body.description, function (err, channel) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(201, channel);
      }
    });
  });
  app.get('/channels', function (req, res) {
    var channelNames, count, sendJSON;
    sendJSON = function (err, result) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(result);
      }
    };
    if (req.query.name != null) {
      return channels.getChannelByName(req.domain, categories, req.query.name, sendJSON);
    } else if (req.query.names != null) {
      return channels.getChannelsWithNames(req.domain, categories, req.query.names, sendJSON);
    } else if (req.query.category != null) {
      return channels.listChannelsInCategory(req.domain, categories, req.query.category, sendJSON);
    } else if (req.query.channel != null) {
      channelNames = Array.isArray(req.query.channel) ? req.query.channel : [req.query.channel];
      return channels.relatedChannels(req.domain, channelNames, sendJSON);
    } else if (req.query.popular != null) {
      count = req.query.count;
      count = count && count <= 5 ? count : 5;
      return channels.mostPopAffectedByUser(req.domain, count, req.query.userId, sendJSON);
    } else if (req.query.badges != null) {
      count = req.query.count;
      count = count && count <= 5 ? count : 5;
      return channels.leaderBadgesInChannelsForUser(req.domain, count, [].concat(req.query.channelIds), req.query.userId, sendJSON);
    } else {
      return channels.listChannels(req.domain, categories, sendJSON);
    }
  });
  app.get('/channels/:id', function (req, res) {
    return channels.getChannel(req.domain, categories, req.params.id, function (err, channel) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(channel);
      }
    });
  });
  app.del('/channels/:id', function (req, res) {
    return channels.deleteChannel(req.domain, req.user_id, req.params.id, function (err) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json({ message: 'channel deleted' });
      }
    });
  });
  app.put('/channels/:id/aliases', function (req, res) {
    return channels.updateAliases(req.domain, req.user_id, req.params.id, req.body, function (err, channel) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(channel.aliases);
      }
    });
  });
  app.get('/channels/:id/tags', function (req, res) {
    return channels.getTags(req.domain, categories, req.params.id, function (err, tags) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(tags);
      }
    });
  });
  app.post('/channels/:id/tags', function (req, res) {
    return channels.addTag(req.domain, categories, req.user_id, req.params.id, req.body.name, function (err, tag) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(201, tag);
      }
    });
  });
  app.get('/channels/:id/tags/:tagid', function (req, res) {
    return channels.getTag(req.domain, categories, req.params.id, req.params.tagid, function (err, tag) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json(tag);
      }
    });
  });
  app.del('/channels/:id/tags/:tagid', function (req, res) {
    return channels.removeTag(req.domain, req.user_id, req.params.id, req.params.tagid, function (err) {
      if (err) {
        return res.json(err.code, { message: err.msg });
      } else {
        return res.json({ message: 'tag deleted' });
      }
    });
  });
  return app;
};