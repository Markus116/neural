var _ = require('underscore');
var async = require('async');
var bodyParser = require('body-parser');
var config = require('config');
var express = require('express');
var expressWs = require('express-ws');
var morgan = require('morgan');
var neuralStyleRenderer = require('./neural-style-renderer');
var neuralStyleUtil = require('./neural-style-util');

var app = express();
expressWs(app);
app.use(morgan('short'));

app.use(express.static('public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.use('/data', express.static(config.get('dataPath')));

var rawBodyParser = bodyParser.raw({limit: '10mb'});
app.post("/upload/:id/:purpose", rawBodyParser, function (req, res) {
    var id = req.params.id;
    var purpose = req.params.purpose;
    console.log("upload called " + id + " " + purpose);

    if (!neuralStyleUtil.validateId(id)) {
        res.status(400).send("invalid id");
        return;
    }
    console.log("saveImage called ");
    neuralStyleUtil.saveImage(id, purpose, req.body, function (err) {
        if (err) {
            res.status(500).send("TRError " + err);
            return;
        }
        res.end();
    });
});

var jsonBodyParser = bodyParser.json();
app.post('/render/:id', jsonBodyParser, function (req, res) {
    var id = req.params.id;
    console.log("render called", id);
    if (!neuralStyleUtil.validateId(id)) {
        res.status(400).send('invalid id');
        return;
    }
    var settings = req.body;
    neuralStyleRenderer.enqueueJob(id, settings);
    res.end();
});

app.post('/cancel/:id', function (req, res) {
    var id = req.params.id;
    console.log("cancel called", id);
    if (!neuralStyleUtil.validateId(id)) {
        res.status(400).send('invalid id');
        return;
    }
    neuralStyleRenderer.cancelJob(id);
    res.end();
});

var updateSockets = [];
app.ws('/updates', function (ws, req) {
    console.log("updates called");
    updateSockets.push(ws);
    ws.on('close', function () {
        var index = updateSockets.indexOf(ws);
        updateSockets.splice(index, 1);
    });

    process.nextTick(function () {
        if (_.findIndex(updateSockets, ws) == -1) {
            return;
        }
        var taskStatuses = neuralStyleRenderer.getTaskStatuses();
        for (var i = taskStatuses.length - 1; i >= 0; i--) {
            ws.send(JSON.stringify({'type': 'render', 'data': taskStatuses[i]}));
        }
    });
});

function broadcastUpdate(type, data) {
    _.each(updateSockets, function (ws) {
        ws.send(JSON.stringify({'type': type, 'data': data}));
    });
}

neuralStyleRenderer.eventEmitter.on('render', function (taskStatus) {
    broadcastUpdate('render', taskStatus);
});

neuralStyleRenderer.eventEmitter.on('status', function (status) {
    broadcastUpdate('status', status);
});

var server = app.listen(config.get('port'), function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://%s:%s', host, port);
});