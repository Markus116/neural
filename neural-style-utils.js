var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var config = require('config');
var imagemagick = require('imagemagick');
var path = require('path');

try {
    console.log("dataPath " + config.get('dataPath'));
    fs.mkdirSync(config.get('dataPath'));
} catch (ex) {
    if (ex.code != 'EEXIST') {
        throw ex;
    }
}

exports.CONTENT = 'content';
exports.STYLE = 'style';
exports.OUTPUT = 'output';

exports.QUEUED = 'queued';
exports.RUNNING = 'running';
exports.DONE = 'done';
exports.FAILED = 'failed';
exports.CANCELLED = 'cancelled';

exports.saveImage = function(id, purpose, data, callback) {
    var outputPath = exports.getImagePathPrefix(id, purpose);
    console.log("save image",outputPath);
    async.waterfall([
        function(cb) {
            fs.writeFile(outputPath, data, cb);
        },
        function(cb) {
            imagemagick.identify(outputPath, cb);
        },
        function(features, cb) {
            var outputPathWithExt;
            if (features['format'] == 'JPEG') {
                outputPathWithExt = outputPath + '.jpg';
            } else if (features['format'] == 'PNG') {
                outputPathWithExt = outputPath + '.png';
            }
            if (outputPathWithExt) {
                fs.rename(outputPath, outputPathWithExt, cb);
            } else {
                cb(null);
            }
        },
    ], callback);
}

exports.getImagePathPrefix = function(id, purpose) {
    console.log("getImagePathPrefix", id, purpose);
    return path.join(
        config.get('dataPath'),
        id + '_' + purpose);
}

exports.getSettingsPath = function(id) {
    return path.join(
        config.get('dataPath'),
        id + '_settings.json');
}

exports.findImagePath = function(id, purpose, callback) {
    var pathPrefix = exports.getImagePathPrefix(id, purpose);
    function makeExtensionCheck(ext) {
        return function(cb) {
            var path = pathPrefix + '.' + ext;
            fs.stat(path, function(err, stats) {
                if (!err) {
                    cb(null, path);
                } else {
                    cb(null, null);
                }
            });
        };
    }
    async.parallel([
        makeExtensionCheck('jpg'),
        makeExtensionCheck('png'),
    ], function(err, results) {
        if (err) {
            callback(err);
            return;
        }
        var result = _.find(results, function(result) {
            return result != null;
        });
        if (result) {
            callback(null, result);
        } else {
            callback(new Error('Missing image with path prefix ' + pathPrefix));
        }
    });
}

exports.imagePathToUrl = function(imagePath) {
    var filename = path.basename(imagePath);
    return path.join('/images', filename);
}

exports.validateId = function(id) {
    return /^\d+$/.exec(id);
}

