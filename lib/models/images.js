var ObjectId, Schema, async, buildDockerImage, configs, copyPublishProperties, cp, crypto, domain, encodeId, error, fs, imageSchema, minus, mongoose, mu, path, plus, request, slash, sync, syncDockerImage, textSearch, underscore, uuid, _, _this = this;
async = require('async');
cp = require('child_process');
configs = require('../configs');
crypto = require('crypto');
domain = require('domain');
error = require('../error');
fs = require('fs');
path = require('path');
mongoose = require('mongoose');
mu = require('mu2');
request = require('request');
sync = require('./sync');
uuid = require('node-uuid');
_ = require('lodash');
textSearch = require('mongoose-text-search');
Schema = mongoose.Schema;
ObjectId = Schema.ObjectId;
imageSchema = new Schema({
  name: { type: String },
  description: {
    type: String,
    'default': ''
  },
  owner: {
    type: ObjectId,
    index: true
  },
  parent: {
    type: ObjectId,
    index: true
  },
  created: {
    type: Date,
    'default': Date.now,
    index: true
  },
  image: { type: String },
  revisions: [{
    repo: String,
    created: {
      type: Date,
      'default': Date.now,
      index: true
    }
  }],
  dockerfile: { type: String },
  cmd: { type: String },
  copies: {
    type: Number,
    'default': 0,
    index: true
  },
  pastes: {
    type: Number,
    'default': 0,
    index: true
  },
  cuts: {
    type: Number,
    'default': 0,
    index: true
  },
  runs: {
    type: Number,
    'default': 0,
    index: true
  },
  views: {
    type: Number,
    'default': 0,
    index: true
  },
  votes: {
    type: Number,
    'default': 0,
    index: true
  },
  port: { type: Number },
  synced: { type: Boolean },
  tags: {
    type: [{
      channel: {
        type: ObjectId,
        index: { sparse: true }
      }
    }],
    'default': []
  },
  output_format: { type: String },
  service_cmds: {
    type: String,
    'default': ''
  },
  start_cmd: {
    type: String,
    'default': 'date'
  },
  build_cmd: {
    type: String,
    'default': ''
  },
  file_root: {
    type: String,
    'default': '/root'
  },
  file_root_host: {
    type: String,
    'default': './src'
  },
  files: {
    type: [{
      name: { type: String },
      path: { type: String },
      dir: { type: Boolean },
      'default': {
        type: Boolean,
        'default': false
      },
      content: { type: String },
      ignore: { type: Boolean }
    }],
    'default': []
  },
  specification: {
    type: ObjectId,
    index: { sparse: true }
  }
});
imageSchema.plugin(textSearch);
imageSchema.set('toJSON', { virtuals: true });
imageSchema.set('autoIndex', true);
imageSchema.index({
  tags: 1,
  parent: 1
});
imageSchema.index({
  name: 'text',
  tags: 'text'
});
buildDockerImage = function (domain, fspath, tag, cb) {
  var child, req;
  child = cp.spawn('tar', [
    '-c',
    '--directory',
    fspath,
    '.'
  ]);
  req = request.post({
    url: '' + configs.harbourmaster + '/build',
    headers: { 'content-type': 'application/tar' },
    qs: { t: tag },
    pool: false
  }, domain.intercept(function (res, body) {
    if (res.statusCode !== 200) {
      return cb(error(res.statusCode, body));
    } else {
      if (body.indexOf('Successfully built') === -1) {
        return cb(error(400, 'could not build image from dockerfile'));
      } else {
        return cb(null, tag);
      }
    }
  }));
  return child.stdout.pipe(req);
};
syncDockerImage = function (domain, image, cb) {
  var encodedId, imageTag, length, servicesToken;
  servicesToken = 'services-' + uuid.v4();
  if (image.revisions && image.revisions.length) {
    length = image.revisions.length;
    encodedId = encodeId(image.revisions[length - 1]._id.toString());
  } else {
    encodedId = encodeId(image._id.toString());
  }
  imageTag = '' + configs.dockerRegistry + '/runnable/' + encodedId;
  return request({
    pool: false,
    url: '' + configs.harbourmaster + '/containers',
    method: 'POST',
    json: {
      servicesToken: servicesToken,
      webToken: 'web-' + uuid.v4(),
      Env: [
        'RUNNABLE_USER_DIR=' + image.file_root,
        'RUNNABLE_SERVICE_CMDS=' + image.service_cmds,
        'RUNNABLE_START_CMD=' + image.start_cmd,
        'RUNNABLE_BUILD_CMD=' + image.build_cmd,
        'SERVICES_TOKEN=' + servicesToken,
        'APACHE_RUN_USER=www-data',
        'APACHE_RUN_GROUP=www-data',
        'APACHE_LOG_DIR=/var/log/apache2',
        'PATH=/dart-sdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      ],
      Hostname: image._id.toString(),
      Image: imageTag,
      PortSpecs: [image.port.toString()],
      Cmd: [image.cmd]
    }
  }, domain.intercept(function (res, body) {
    if (res.statusCode !== 204) {
      return cb(error(res.statusCode, body));
    } else {
      return sync(domain, servicesToken, image, function (err) {
        if (err) {
          return cb(err);
        } else {
          return request({
            pool: false,
            url: '' + configs.harbourmaster + '/containers/' + servicesToken,
            method: 'DELETE'
          }, domain.intercept(function (res) {
            if (res.statusCode !== 204) {
              return cb(error(res.statusCode, body));
            } else {
              return cb();
            }
          }));
        }
      });
    }
  }));
};
imageSchema.statics.createFromDisk = function (domain, owner, runnablePath, sync, cb) {
  var _this = this;
  return fs.exists('' + runnablePath + '/runnable.json', function (exists) {
    var err, runnable;
    if (!exists) {
      return cb(error(400, 'runnable.json not found'));
    } else {
      try {
        runnable = require('' + runnablePath + '/runnable.json');
      } catch (_error) {
        err = _error;
        err = err;
      }
      if (err) {
        return cb(error(400, 'runnable.json is not valid'));
      } else {
        if (!runnable.name) {
          return cb(error(400, 'runnable.json is not valid'));
        } else {
          return fs.exists('' + runnablePath + '/Dockerfile', function (exists) {
            if (!exists) {
              return cb(error(400, 'dockerfile not found'));
            } else {
              return fs.readFile('' + runnablePath + '/Dockerfile', 'utf8', function (err, dockerfile) {
                if (err) {
                  throw err;
                }
                return mu.compileText('Dockerfile', dockerfile, function (err, compiled) {
                  var rendered, writestream;
                  if (err) {
                    return cb(error(400, 'error compiling mustache template: ' + err.message));
                  } else {
                    rendered = mu.render(compiled, {
                      file_root: runnable.file_root,
                      file_root_host: runnable.file_root_host,
                      image: runnable.image,
                      port: runnable.port
                    });
                    writestream = fs.createWriteStream('' + runnablePath + '/Dockerfile', 'utf8');
                    writestream.on('error', function (err) {
                      throw err;
                    });
                    writestream.on('close', function () {
                      return _this.findOne({ name: runnable.name }, domain.intercept(function (existing) {
                        var encodedId, image, tag;
                        if (existing) {
                          return cb(error(403, 'a runnable by that name already exists'));
                        } else {
                          image = new _this();
                          encodedId = encodeId(image._id.toString());
                          tag = '' + configs.dockerRegistry + '/runnable/' + encodedId;
                          return buildDockerImage(domain, runnablePath, tag, function (err) {
                            var file, _i, _len, _ref;
                            if (err) {
                              return cb(err);
                            } else {
                              image.owner = owner;
                              image.name = runnable.name;
                              image.image = runnable.image;
                              image.dockerfile = dockerfile;
                              image.cmd = runnable.cmd;
                              if (runnable.description) {
                                image.description = runnable.description;
                              }
                              if (runnable.file_root_host) {
                                image.file_root_host = runnable.file_root_host;
                              }
                              if (runnable.file_root) {
                                image.file_root = runnable.file_root;
                              }
                              if (runnable.service_cmds) {
                                image.service_cmds = runnable.service_cmds;
                              }
                              if (runnable.start_cmd) {
                                image.start_cmd = runnable.start_cmd;
                              }
                              if (runnable.build_cmd) {
                                image.build_cmd = runnable.build_cmd;
                              }
                              image.port = runnable.port;
                              runnable.tags = runnable.tags || [];
                              _ref = runnable.files;
                              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                                file = _ref[_i];
                                image.files.push(file);
                              }
                              if (sync) {
                                return syncDockerImage(domain, image, function (err) {
                                  if (err) {
                                    return cb(err);
                                  } else {
                                    image.synced = true;
                                    return image.save(domain.intercept(function () {
                                      return cb(null, image, runnable.tags);
                                    }));
                                  }
                                });
                              } else {
                                return image.save(domain.intercept(function () {
                                  return cb(null, image, runnable.tags);
                                }));
                              }
                            }
                          });
                        }
                      }));
                    });
                    return rendered.pipe(writestream);
                  }
                });
              });
            }
          });
        }
      }
    }
  });
};
imageSchema.statics.createFromContainer = function (domain, container, cb) {
  var _this = this;
  return this.findOne({ name: container.name }, domain.intercept(function (existing) {
    var encodedId, image;
    if (existing) {
      return cb(error(403, 'a shared runnable by that name already exists'));
    } else {
      image = new _this();
      copyPublishProperties(image, container);
      image.revisions = [];
      image.revisions.push({ repo: container._id.toString() });
      image.synced = true;
      encodedId = encodeId(image._id.toString());
      container.child = image._id;
      return container.save(domain.intercept(function () {
        return image.save(domain.intercept(function () {
          return cb(null, image);
        }));
      }));
    }
  }));
};
imageSchema.statics.countInChannelByOwner = function (domain, channelId, ownerId, cb) {
  return this.count({
    'owner': ownerId,
    'tags.channel': channelId
  }, domain.intercept(function (count) {
    return cb(null, count);
  }));
};
imageSchema.statics.search = function (domain, searchText, limit, cb) {
  var opts;
  opts = {
    filter: { tags: { $not: { $size: 0 } } },
    project: {
      name: 1,
      description: 1,
      tags: 1,
      owner: 1,
      created: 1
    },
    limit: limit <= configs.defaultPageLimit ? limit : configs.defaultPageLimit
  };
  return this.textSearch(searchText, opts, function (err, output) {
    var images;
    if (err) {
      throw err;
    } else {
      images = output.results.map(function (result) {
        return result.obj;
      });
      return cb(null, images);
    }
  });
};
imageSchema.statics.incVote = function (domain, runnableId, cb) {
  return this.update({ _id: runnableId }, { $inc: { votes: 1 } }, domain.intercept(function (success) {
    return cb(null, success);
  }));
};
imageSchema.methods.updateFromContainer = function (domain, container, cb) {
  var _this = this;
  copyPublishProperties(_this, container, true);
  _this.revisions = _this.revisions || [];
  _this.revisions.push({ repo: container._id.toString() });
  container.child = _this._id;
  return container.save(domain.intercept(function () {
    return _this.save(domain.intercept(function () {
      return cb(null, _this);
    }));
  }));
};
imageSchema.statics.destroy = function (domain, id, cb) {
  var _this = this;
  return this.findOne({ _id: id }, domain.intercept(function (image) {
    if (!image) {
      return cb(error(404, 'image not found'));
    } else {
      return _this.remove({ _id: id }, domain.intercept(function () {
        return cb();
      }));
    }
  }));
};
imageSchema.statics.listTags = function (domain, cb) {
  return this.find().distinct('tags.name', domain.intercept(function (tagNames) {
    return cb(null, tagNames);
  }));
};
imageSchema.statics.relatedChannelIds = function (domain, channelIds, cb) {
  return this.distinct('tags.channel', { 'tags.channel': { $in: channelIds } }, domain.intercept(function (channelIds) {
    return cb(null, channelIds);
  }));
};
imageSchema.statics.isOwner = function (domain, userId, runnableId, cb) {
  return this.findOne({ _id: runnableId }, {
    _id: 1,
    owner: 1
  }, domain.intercept(function (image) {
    if (!image) {
      return cb(error(404, 'runnable not found'));
    } else {
      return cb(null, image.owner.toString() === userId.toString());
    }
  }));
};
imageSchema.methods.sync = function (domain, cb) {
  var _this = this;
  if (this.synced) {
    return cb();
  } else {
    return syncDockerImage(domain, this, function (err) {
      if (err) {
        return cb(err);
      } else {
        _this.synced = true;
        return _this.save(domain.intercept(function () {
          return cb();
        }));
      }
    });
  }
};
plus = /\+/g;
slash = /\//g;
minus = /-/g;
underscore = /_/g;
encodeId = function (id) {
  return new Buffer(id.toString(), 'hex').toString('base64').replace(plus, '-').replace(slash, '_');
};
copyPublishProperties = function (image, container, noOwner) {
  var objectIdProperties, properties;
  properties = [
    'name',
    'description',
    'tags',
    'files',
    'image',
    'dockerfile',
    'file_root',
    'file_root_host',
    'cmd',
    'build_cmd',
    'start_cmd',
    'service_cmds',
    'port',
    'output_format'
  ];
  objectIdProperties = [
    'parent',
    'specification'
  ];
  if (!noOwner) {
    objectIdProperties.push('owner');
  }
  properties.forEach(function (property) {
    image[property] = _.clone(container[property]);
  });
  return objectIdProperties.forEach(function (property) {
    image[property] = container[property] && container[property].toString();
  });
};
module.exports = mongoose.model('Images', imageSchema);