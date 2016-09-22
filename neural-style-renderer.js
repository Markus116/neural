var _ = require('underscore');
var async = require('async');
var childProcess = require('child_process');
var config = require('config');
var events = require('events');
var fs = require('fs');
var neuralStyleUtil = require('./neural-style-util');
var path = require('path');
var util = require('util');
var xml2js = require('xml2js');

var NUM_PROGRESS_IMAGES = 10;

function queryGpus(callback) {
    return callback({});
}
exports.queryGpus = queryGpus;

function getTaskStatus(task) {
    var status = {
        'id': task.id,
        'contentUrl': neuralStyleUtil.imagePathToUrl(task.contentPath),
        'styleUrl': neuralStyleUtil.imagePathToUrl(task.stylePath),
        'settings': task.settings,
        'state': task.state,
        'iter': task.iter,
        'outputUrls': [],
    };
    var outputPath = neuralStyleUtil.getImagePathPrefix(task.id, neuralStyleUtil.OUTPUT);
    var saveIterStep = task.settings.numIterations / NUM_PROGRESS_IMAGES;
    for (var i = saveIterStep; i < task.iter; i += saveIterStep) {
        status['outputUrls'].push(neuralStyleUtil.imagePathToUrl(outputPath + '_' + i + '.png'));
    }
    if (task.state == neuralStyleUtil.DONE) {
        status['outputUrls'].push(neuralStyleUtil.imagePathToUrl(outputPath + '.png'));
    }

    return status;
}

function runRender(task, callback) {
    if (task.state == neuralStyleUtil.CANCELLED) {
        return callback();
    }

    task.state = neuralStyleUtil.RUNNING;
    sendTaskStatusEvent(task);

    var outputPath = neuralStyleUtil.getImagePathPrefix(task.id, neuralStyleUtil.OUTPUT);
    var printIterStep = task.settings.numIterations / 100;
    var saveIterStep = task.settings.numIterations / NUM_PROGRESS_IMAGES;

    var params = [
        path.join(config.get('neuralStylePath'), 'neural_style.lua'),
        '-content_image', task.contentPath,
        '-style_image', task.stylePath,
        '-gpu', -1,
        '-num_iterations', task.settings.numIterations,
        '-optimizer', task.settings.optimizer,
        '-output_image', outputPath + '.png'
    ];

    if (task.settings.normalizeGradients) {
        params.push('-normalize_gradients');
    }

    util.log('Running neural_style for id ' + task.id + ' with params: ' + params);
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
    neuralStyle.stdout.on('data', function (data) {
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

    neuralStyle.on('exit', function (code) {
        if (code != 0) {
            util.log('neural_style failed for id ' + task.id + ' with code ' + code + '\n' + neuralStyle.stderr.read());
            if (task.state != neuralStyleUtil.CANCELLED) {
                task.state = neuralStyleUtil.FAILED;
            }
        } else {
            util.log('neural_style done for id ' + task.id);
            task.state = neuralStyleUtil.DONE;
        }
        sendTaskStatusEvent(task);
        sendStatusEvent();
        callback();
    });
}

var workqueue = [];
var tasks = [];

queryGpus(function(gpuInfo) {
    /*gpuIndexes = _.range(gpuInfo.attached_gpus[0]);
    workqueue = async.queue(runRender, gpuInfo.attached_gpus[0]);*/
});

neuralStyleUtil.getExistingTasks(function (err, existingTasks) {
    if (err) {
        util.log('Failed to find existing tasks: ' + err);
        return;
    }
    tasks = tasks.concat(existingTasks);
    _.each(existingTasks, function (task) {
        sendTaskStatusEvent(task);
    });
});

var DEFAULT_SETTINGS = {
    'numIterations': 50,
    'init': 'random',
    'normalizeGradients': true,
    'styleScale': 1.0,
    'optimizer': 'adam',
    'learningRate': 10.0
};

exports.enqueueJob = function (id, settings) {
    console.log("enqueueJob " , id);
    //settings = _.defaults(settings, DEFAULT_SETTINGS);
    settings = DEFAULT_SETTINGS;
    async.parallel([
        function (cb) {
            fs.writeFile(neuralStyleUtil.getSettingsPath(id), JSON.stringify(settings), cb);
        },
        function (cb) {
            neuralStyleUtil.findImagePath(id, neuralStyleUtil.CONTENT, cb);
        },
        function (cb) {
            neuralStyleUtil.findImagePath(id, neuralStyleUtil.STYLE, cb);
        },
    ], function (err, results) {
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
            util.log(err);
            task.state = neuralStyleUtil.FAILED;
        } else {
            console.log("push task");
            workqueue.push(task);
        }
        sendTaskStatusEvent(task);
        sendStatusEvent(task);
    });
}

exports.cancelJob = function (id) {
    _.each(tasks, function (task) {
        if (task.id == id &&
            (task.state == neuralStyleUtil.QUEUED || task.state == neuralStyleUtil.RUNNING)) {
            task.state = neuralStyleUtil.CANCELLED;
            sendTaskStatusEvent(task);
        }
    });
}

exports.getTaskStatuses = function () {
    return _.map(tasks, getTaskStatus);
}

exports.getStatus = function (callback) {
    queryGpus(function (gpuInfo) {
        callback({});
    });
}

exports.eventEmitter = new events.EventEmitter();
function sendStatusEvent(task) {
    runRender(task, function () {
            exports.eventEmitter.emit('status', status);
        }
    );
    /*exports.getStatus(function (status) {

    });*/
}
function sendTaskStatusEvent(task) {
    exports.eventEmitter.emit('render', getTaskStatus(task));
}
