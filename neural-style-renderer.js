var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var config = require('config');
var events = require('events');
var path = require('path');
var childProcess = require('child_process');
var neuralStyleUtil = require('./neural-style-utils');

var NUM_PROGRESS_IMAGES = 10;
var TOTAL_ITER_NUM = 10;

function getTaskStatus(task) {
    console.log("getTaskStatus",task.id);
    var status = {
        'id': task.id,
        'contentUrl': neuralStyleUtil.imagePathToUrl(task.contentPath),
        'styleUrl': neuralStyleUtil.imagePathToUrl(task.stylePath),
        'settings': task.settings,
        'state': task.state,
        'iter': task.iter,
        'totalIter': TOTAL_ITER_NUM
    };

    var outputPath = neuralStyleUtil.getImagePathPrefix(task.id, neuralStyleUtil.OUTPUT);
    if (task.state == neuralStyleUtil.DONE) {
        status['outputUrl'] = neuralStyleUtil.imagePathToUrl(outputPath + '.png');
    }

    return status;
}

function runRender(task, callback) {
    console.log("runRender ", task.id);
    if (task.state == neuralStyleUtil.CANCELLED) {
        return callback();
    }

    task.state = neuralStyleUtil.RUNNING;
    sendTaskStatusEvent(task);

    var outputPath = neuralStyleUtil.getImagePathPrefix(task.id, neuralStyleUtil.OUTPUT);
    var params = [
        path.join(config.get('neuralStylePath'), 'neural_style.lua'),
        '-content_image', task.contentPath,
        '-style_image', task.stylePath,
        '-gpu', task.settings.gpu,
        '-num_iterations', task.settings.numIterations,
        '-output_image', outputPath + '.png',
        '-print_iter', 1
    ];

    if (task.settings.normalizeGradients) {
        params.push('-normalize_gradients');
    }

    console.log('Running neural_style for id ' + task.id + ' with params: ' + params);
    var neuralStyle = childProcess.spawn('th', params, {
        'cwd': config.get('neuralStylePath'),
    });


    function getLatestIteration(stdout) {
        var iterRegex = /Iteration (\d+) \/ \d+/;
        var lines = stdout.split('\n');
        var i = lines.length - 1;
        while (i >= 0) {
            var match = iterRegex.exec(lines[i]);
            if (match) {
                return Number(match[1]);
            }
            i--;
        }
        return 0;
    }

    var stdout = '';
    var lastIter = 0;
    neuralStyle.stdout.on('data', function(data) {
        console.log(String(data));
        stdout += String(data);
        task.iter = getLatestIteration(stdout);
        if (task.iter > lastIter) {
            lastIter = task.iter;
            sendTaskStatusEvent(task);
        }

        if (task.state == neuralStyleUtil.CANCELLED) {
            neuralStyle.kill();
        }
    });

    neuralStyle.on('exit', function(code) {
        if (code != 0) {
            console.log('neural_style failed for id ' + task.id + ' with code ' + code + '\n' + neuralStyle.stderr.read());
            if (task.state != neuralStyleUtil.CANCELLED) {
                task.state = neuralStyleUtil.FAILED;
            }
        } else {
            console.log('neural_style done for id ' + task.id);
            task.state = neuralStyleUtil.DONE;
        }
        sendTaskStatusEvent(task);
        callback();
    });
}

var workqueue = [];
var tasks = [];

var DEFAULT_SETTINGS = {
    'normalizeGradients': false,
    'optimizer': 'adam',
    'numIterations':10,
    'gpu':-1
};

exports.enqueueJob = function(id, settings) {
    console.log("Added to queue " + id);
    settings = _.defaults(settings, DEFAULT_SETTINGS);
    async.parallel([
        function(cb) {
            fs.writeFile(neuralStyleUtil.getSettingsPath(id), JSON.stringify(settings), cb);
        },
        function(cb) {
            neuralStyleUtil.findImagePath(id, neuralStyleUtil.CONTENT, cb);
        },
        function(cb) {
            neuralStyleUtil.findImagePath(id, neuralStyleUtil.STYLE, cb);
        },
    ], function(err, results) {
        var task = {
            'id': id,
            'state': neuralStyleUtil.QUEUED,
            'contentPath': results[1],
            'stylePath': results[2],
            'settings': settings,
            'iter': 0
        };
        tasks.unshift(task);
        if (err) {
            console.log("FAILED " + err);
            task.state = neuralStyleUtil.FAILED;
        } else {
            workqueue.push(task);
            runRender(task, function () {})
        }
        sendTaskStatusEvent(task);
    });
}

exports.cancelJob = function(id) {
    _.each(tasks, function(task) {
        if (task.id == id &&
            (task.state == neuralStyleUtil.QUEUED || task.state == neuralStyleUtil.RUNNING)) {
            task.state = neuralStyleUtil.CANCELLED;
            sendTaskStatusEvent(task);
        }
    });
}

exports.getTaskStatuses = function() {
    return _.map(tasks, getTaskStatus);
}

exports.eventEmitter = new events.EventEmitter();
function sendTaskStatusEvent(task) {
    exports.eventEmitter.emit('render', getTaskStatus(task));
}

/*function sendStatusEvent() {
    exports.getStatus(function(status) {
        exports.eventEmitter.emit('status', status);
    });
}
setInterval(sendStatusEvent, 15000);*/