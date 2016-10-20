var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var config = require('config');
var events = require('events');
var path = require('path');
var childProcess = require('child_process');
var neuralStyleUtil = require('./neural-style-utils');

var models = [
    "models/instance_norm/candy.t7",
    "models/eccv16/composition_vii.t7",
    "models/instance_norm/feathers.t7",
    "models/eccv16/la_muse.t7",
    "models/instance_norm/mosaic.t7",
    "models/eccv16/starry_night.t7",
    "models/instance_norm/the_scream.t7",
    "models/instance_norm/udnie.t7",
    "models/eccv16/the_wave.t7"
];

function getTaskStatus(task) {
    console.log("getTaskStatus",task.id);
    var status = {
        'id': task.id,
        'contentUrl': neuralStyleUtil.imagePathToUrl(task.contentPath),
        'settings': task.settings,
        'state': task.state,
        'modelId': task.modelId
    };

    var outputPath = neuralStyleUtil.getImagePathPrefix(task.id, neuralStyleUtil.OUTPUT);
    if (task.state == neuralStyleUtil.DONE) {
        status['outputUrl'] = neuralStyleUtil.imagePathToUrl(outputPath + '.png');
    }

    return status;
}

function getModelpathById(id){
    return models[id-1];
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
        path.join(config.get('neuralStylePath'), 'fast_neural_style.lua'),
        '-model',task.modelPath,
        '-input_image', task.contentPath,
        '-output_image', outputPath + '.png',
        '-gpu', task.settings.gpu
    ];

    console.log('Running neural_style for id ' + task.id + ' with params: ' + params);
    var neuralStyle = childProcess.spawn('th', params, {
        'cwd': config.get('neuralStylePath'),
    });


    function getIsTaskCompleted(stdout) {
        var iterRegex = /Writing output image to (.)+\.png/;
        var lines = stdout.split('\n');
        var i = lines.length - 1;
        while (i >= 0) {
            var match = iterRegex.exec(lines[i]);
            if (match && match.length > 0) {
                return true;
            }
            i--;
        }
        return false;
    }

    var stdout = '';
    var lastIter = 0;
    neuralStyle.stdout.on('data', function(data) {
        console.log(String(data));
        stdout += String(data);
        var isTaskCompleted = getIsTaskCompleted(stdout);
        if (isTaskCompleted) {
            //task.state = neuralStyleUtil.DONE;
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
    ], function(err, results) {
        var task = {
            'id': id,
            'state': neuralStyleUtil.QUEUED,
            'contentPath': results[1],
            'settings': settings,
            'modelId': settings.modelId,
            'modelPath': getModelpathById(settings.modelId)
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
