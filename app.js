var _ = require('underscore');
var async = require('async');
var bodyParser = require('body-parser');
var config = require('config');
var express = require('express');
var expressWs = require('express-ws');
var morgan = require('morgan');
var cors = require('cors');

var neuralStyleUtil = require('./neural-style-utils');
var neuralStyleRenderer = require('./neural-style-renderer');


var app = express();
expressWs(app);
app.use(morgan('short'));
app.use('/images',express.static('images'));
app.use(cors());

var updateSockets = [];
//var socketsMap = {};

app.ws('/updates', function (ws, req) {
    //var id = req.params.id;
    updateSockets.push(ws);
    //socketsMap[id] = ws;
    console.log("updates called - new connection, " + updateSockets.length);
    ws.on('close', function () {
        var index = updateSockets.indexOf(ws);
        updateSockets.splice(index, 1);
        //delete socketsMap[id];
    });
});

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
app.post('/render/:id',jsonBodyParser,function(req, res){
    var id = req.params.id;
    console.log("start called");

    if (!neuralStyleUtil.validateId(req.params.id)) {
        res.status(400).send('invalid id');
        return;
    }
    var settings = req.body;
    neuralStyleRenderer.enqueueJob(req.params.id, settings);
    res.end();
});

function broadcastUpdates(type, data) {
    _.each(updateSockets, function (ws) {
        ws.send(JSON.stringify({'type': type, 'data': data}));
    });
}

function broadcastUpdate(ws,type, data){
    ws.send(JSON.stringify({'type': type, 'data': data}));
}

neuralStyleRenderer.eventEmitter.on('render', function(taskStatus) {
    broadcastUpdates('render', taskStatus);
});

var server = app.listen(config.get('port'), function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://%s:%s', host, port);
});