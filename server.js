var _ = require('underscore');
var bodyParser = require('body-parser');
var config = require('config');
var express = require('express');
var async = require('async');
var fs = require('fs');
var childProcess = require('child_process');
var morgan = require('morgan');
var cors = require('cors');
var path = require('path');
var Buffer = require('buffer').Buffer;

var app = express();
app.use(morgan('short'));
app.use('/', express.static('public'));
app.use('/images', express.static('images'));
app.use(cors());

var allowCrossDomain = function(req, res, next) {
    if ('OPTIONS' == req.method) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        res.send(200);
    }else {
        next();
    }
};

app.use(allowCrossDomain);

var models = [
    "models/instance_norm/candy.t7",
    "models/eccv16/composition_vii.t7",
    "models/instance_norm/feathers.t7",
    "models/eccv16/la_muse.t7",
    "models/instance_norm/mosaic.t7",
    "models/eccv16/starry_night.t7",
    "models/instance_norm/the_scream.t7",
    "models/instance_norm/udnie.t7",
    "models/eccv16/the_wave.t7",
    "models/eccv16/blue.t7",
    "models/eccv16/warhol.t7",
    "models/eccv16/watercolor_Jolie.t7",
    "models/eccv16/vangogh.t7",
    "models/eccv16/the_bedroom_arles.t7",
    "models/eccv16/tintin.t7",
    "models/eccv16/nijntje.t7",

];

var jsonBodyParser = bodyParser.json({limit: '10mb'});

app.post("/render", jsonBodyParser, function (req, res) {
    var fileId = getUniqueId();
    console.log("save bitmap to file ", fileId);
    if (req.body) {
        var fileData = {
            image: req.body.image,
            filterId: req.body.filterId,
            fileId: fileId,
            resultImage: null
        };

        /*fileData.path = path.join(config.get('dataPath'), fileData.fileId + ".png");
        fileData.resultPath = path.join(config.get('dataPath'), fileData.fileId + "_res.png");*/

        saveBase64ImageToFile(fileData)
            .then(renderFile)
            .then(readResultFile)
            .then(function (fileData) {
                console.log("DONE");
                res.header("Access-Control-Allow-Origin","*");
                res.send({image: fileData.resultImage, path: getRelativeFilePath(fileData.fileId,true)});
                return;
            })
            .catch(function (err) {
                console.error(err);
                res.status(400).send('invalid image data');
            });
    } else {
        res.status(400).send('invalid image data');
    }
});

function saveBase64ImageToFile(fileData) {
    return new Promise((resolve, reject) => {
        console.log("saveImageVVV");
        var imageBase = fileData.image.split(",")[1];
        var ImageBuffer = new Buffer(imageBase, 'base64'); // decode
        fs.writeFile(getFilePath(fileData.fileId,false), ImageBuffer, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve(fileData);
        })
    });
}

function getFilePath(fileId, isRes) {
    var pref = (isRes == true ? "_res" : "");
    return path.join(config.get('dataPath'), fileId + pref + ".png")
}

function getRelativeFilePath(fileId, isRes) {
    var pref = (isRes == true ? "_res" : "");
    return '/images/'+ fileId + pref + ".png";
}

function readResultFile(fileData) {
    return new Promise((resolve, reject) => {
        console.log("readResultFile");
        fs.readFile(getFilePath(fileData.fileId,true), {encoding: 'base64'}, function (err, data) {
            if (err) {
                console.error("readResultFile error", err);
                reject(err);
                return;
            }
            fileData.resultImage = "data:image/png;base64," + data;
            resolve(fileData);
        });
    });
}

function renderFile(fileData) {
    return new Promise((resolve, reject) => {
        console.log("renderFile2 outputPath", getFilePath(fileData.fileId,true));
        var params = [
            path.join(config.get('neuralStylePath'), 'fast_neural_style.lua'),
            '-model', getModelPath(fileData.filterId),
            '-input_image', getFilePath(fileData.fileId,false),
            '-output_image', getFilePath(fileData.fileId,true),
            '-gpu', 0,
            '-image_size', 0
        ];


        var neuralStyle = childProcess.spawn('th', params, {
            'cwd': config.get('neuralStylePath'),
        });

        var stdout = '';
        var isTaskCompleted = false;
        neuralStyle.stdout.on('data', function (stdata) {
            console.log(String(stdata));
            stdout += String(stdata);
            isTaskCompleted = getIsTaskCompleted(stdout);
            if (isTaskCompleted) {
                console.log("task completed");
                //neuralStyle.kill();
                //resolve(fileData);
            }
        });

        neuralStyle.on('exit', function (code) {
            console.log("task exited");

            if (isTaskCompleted) {
                resolve(fileData);
                return;
            }
            if (code != 0) {
                console.log('neural_style failed for id with code ' + code + '\n' + neuralStyle.stderr.read());
                reject("Error");
            }
        });
    });
}

function getModelPath(id) {
    var modelId = Number(id);
    var modelPath = models[modelId - 1];
    console.log("modelId = " + id + " " + modelId, modelPath);
    return path.join(config.get('neuralStylePath'), modelPath);
}

function getUniqueId() {
    return Math.round(Math.random() * Math.pow(10, 16));
}

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

try {
    console.log("dataPath " + config.get('dataPath'));
    fs.mkdirSync(config.get('dataPath'));
} catch (ex) {
    if (ex.code != 'EEXIST') {
        throw ex;
    }
}

var server = app.listen(config.get('port'), function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://%s:%s', host, port);
});