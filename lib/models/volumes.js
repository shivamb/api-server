var async = require('async');
var utils = require('middleware/utils');
var configs = require('configs');
var error = require('error');
var request = require('request');
var exts = require('extensions');
if (configs.dockworkerProxy) {
  request = request.defaults({
    proxy: configs.dockworkerProxy
  });
}
var volumes = {
  createFs: function (container, data, cb) {
    if (data.dir) {
      this.createDirectory(container, data.name, data.path, cb);
    }
    else {
      this.createFile(container, data.name, data.path, data.content, cb);
    }
  },
  createFile: function (container, name, path, content, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/create',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path,
        content: content
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  createDirectory: function (container, name, path, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/mkdir',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  streamFile: function (container, name, path, stream, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    var r = request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/stream',
      method: 'POST'
    });
    var form = r.form();
    form.append('dir', srcDir);
    form.append('name', name);
    form.append('path', path);
    form.append('content', stream);
    r.on('error', cb);
    r.on('response', function (res) {
      if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
    stream.resume();
  },
  readFile: function (container, name, path, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/read',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb(null, res.body);
      }
    });
  },
  updateFile: function (container, origData, newData, cb) {
    var file = origData;
    async.series([
      function (cb) {
        if (!utils.exists(newData.name)) {
          return cb();
        }
        volumes.renameFile(container, file.name, file.path, newData.name, cb);
        file.name = newData.name;
      },
      function (cb) {
        if (!utils.exists(newData.path)) {
          return cb();
        }
        volumes.moveFile(container, file.name, file.path, newData.path, cb);
        file.path = newData.path;
      },
      function (cb) {
        if (!utils.exists(newData.content)) {
          return cb();
        }
        volumes.updateFileContent(container, file.name, file.path, newData.content, cb);
      }
    ],
    function (err, results) {
      cb(err); //ignore results
    });
  },
  updateFileContent: function (container, name, path, content, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/update',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path,
        content: content
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  renameFile: function (container, name, path, newName, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/rename',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path,
        newName: newName
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  moveFile: function (container, name, path, newPath, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/move',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path,
        newPath: newPath
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  removeFs: function (container, fs, cb) {
    if (fs.dir) {
      volumes.removeDirectory(container, fs.name, fs.path, true, cb);
    } else {
      volumes.removeFile(container, fs.name, fs.path, cb);
    }
  },
  removeFile: function (container, name, path, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/delete',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  removeDirectory: function (container, name, path, recursive, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/rmdir',
      method: 'POST',
      json: {
        dir: srcDir,
        name: name,
        path: path,
        recursive: recursive
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
  },
  readAllFiles: function (container, ignores, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/readall',
      method: 'POST',
      json: {
        dir: srcDir,
        ignores: ignores,
        exts: exts
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb(null, res.body);
      }
    });
  },
  readDirectory: function (container, subDir, exts, cb) {
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.userContentDomain + '/api/files/readdir',
      method: 'POST',
      json: {
        dir: srcDir,
        sub: subDir,
        exts: exts
      }
    }, function (err, res) {
      if (err) {
        cb(err);
      } else if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 201) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb(null, res.body);
      }
    });
  }
};
module.exports = volumes;
