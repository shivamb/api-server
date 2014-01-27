var async = require('async');
var fs = require('fs');
var fstream = require('fstream');
var os = require('os');
var uuid = require('node-uuid');
var error = require('error');
var rimraf = require('rimraf');
var Image = require('models/images');
var tar = require('tar');
var zlib = require('zlib');
var request = require('request');
var configs = require('configs');
var utils = require('middleware/utils');
var createModelMiddleware = require('./createModelMiddleware');

var images = module.exports = createModelMiddleware(Image, {
  protectTmpDir: function (err, req, res, next) {
    console.error('pro', err);
    if (req.tmpdir) {
      rimraf(req.tmpdir, function (e) {
        next(e || err);
      });
    } else {
      next(err);
    }
  },
  writeTarGz: function (req, res, next) {
    req.tmpdir = '' + os.tmpdir() + '/' + uuid.v4();
    fs.mkdir(req.tmpdir, req.domain.intercept(function () {
      req
        .pipe(zlib.createUnzip())
        .pipe(tar.Parse())
        .pipe(fstream.Writer({ path: req.tmpdir }))
          .on('close', next);
    }));
  },
  findDockerfile: function (req, res, next) {
    fs.exists(req.tmpdir + '/Dockerfile', function (exists) {
      if (exists) {
        req.dockerdir = req.tmpdir;
        next();
      } else {
        fs.readdir(req.tmpdir, req.domain.intercept(function (files) {
          req.dockerdir = req.tmpdir + '/' + files[0];
          fs.exists(req.dockerdir + '/Dockerfile', function (exists) {
            if (!exists) {
              next(error(400, 'could not find Dockerfile'));
            } else {
              next();
            }
          });
        }));
      }
    });
  },
  loadDockerfile: function (req, res, next) {
    fs.readFile(req.dockerdir + '/Dockerfile', 'utf8', req.domain.intercept(function (dockerfile) {
      req.dockerfile = dockerfile;
      next();
    }));
  },
  parseDockerFile: function (req, res, next) {
    req.cmd = /^CMD\s+(.+)$/m.exec(req.dockerfile);
    if (req.cmd == null) {
      return next(error(400, 'Dockerfile needs CMD'));
    }
    req.cmd = req.cmd.pop();
    try {
      req.cmd = JSON.parse(req.cmd).join(' ');
    } catch (e) {}
    req.workdir = /^WORKDIR\s+(.+)$/m.exec(req.dockerfile);
    if (req.workdir == null) {
      return next(error(400, 'Dockerfile needs WORKDIR'));
    }
    req.workdir = req.workdir.pop();
    next();
  },
  readTempFiles: function (req, res, next) {
    // for now just covering our test usecase
    fs.readdir(req.dockerdir + '/src', req.domain.intercept(function (filenames) {
      async.map(filenames, function readFile (filename, cb) {
        fs.readFile(req.dockerdir + '/src/' + filename, 'utf8',
          req.domain.intercept(function (file) {
            cb(null, {
              name: filename,
              path: '/',
              dir: false,
              default: true,
              content: file,
              ignore: false
            });
          }));
      }, req.domain.intercept(function (files) {
        req.files = files;
        next();
      }));
    }));
  },
  createImage: function (req, res, next) {
    res.code = 201;
    req.image = new Image({
      owner: req.user_id,
      name: req.query.name
    });
    if (req.files) {
      req.files.forEach(function (file) {
        req.files.push(file);
      });
    }
    next();
  },
  fetchImage: function (req, res, next) {
    var imageId = utils.decodeId(req.params.imageId);
    if (!utils.isObjectId(imageId)) {
      return next(error(400, 'invalid image id'));
    }
    Image.findById(imageId, req.domain.intercept(function (image) {
      if (!image) {
        next(error(404, 'image not found'));
      } else {
        req.image = image;
        next();
      }
    }));
  },
  fetchChannelImage: function (req, res, next) {
    var channel = req.channel;
    async.waterfall([
      function (cb) {
        if (channel.base) {
          Image.findById(channel.base, cb);
        }
        else {
          Image.findFirstImageInChannel(channel._id, cb);
        }
      }
    ],
    req.domain.intercept(function (image) {
      if (!image) {
        next(error(404, 'image not found'));
      } else {
        req.image = image;
        next();
      }
    }));
  },
  imageInheritFromContainer: function (req, res, next) {
    req.image.inheritFromContainer(req.container);
    next();
  },
  buildDockerImage: function (req, res, next) {
    fstream.Reader({
      path: req.dockerdir,
      type: 'Directory',
      mode: '0755'
    }).pipe(tar.Pack())
      .pipe(zlib.createGzip())
      .pipe(request.post({
        url: configs.harbourmaster + '/build',
        headers: { 'content-type': 'application/x-gzip' },
        qs: { t: configs.dockerRegistry + '/runnable/' + req.image._id.toString() },
        pool: false
      }, req.domain.intercept(function (resp, body) {
        if (resp.statusCode !== 200) {
          next(error(resp.statusCode, body));
        } else if (body.indexOf('Successfully built') === -1) {
          next(error(400, body));
        } else {
          // add revision
          next();
        }
      })));
  },
  saveImage: function (req, res, next) {
    req.image.save(req.domain.intercept(function (image) {
      req.image = image;
      next();
    }));
  },
  cleanTmpDir: function (req, res, next) {
    rimraf(req.tmpdir, next);
  },
  returnImage: function (req, res) {
    req.image.returnJSON(req.domain.intercept(function (json) {
      res.json(res.code || 200, json);
    }));
  }
});