var _ = require('underscore');
var bodyParser = require('body-parser');
var config = require('config');
var express = require('express');
var async = require('async');
var childProcess = require('child_process');
var morgan = require('morgan');
var cors = require('cors');

var app = express();
app.use(morgan('short'));
app.use('/images',express.static('images'));
app.use(cors());

/*var models = [
    "models/instance_norm/candy.t7",
    "models/eccv16/composition_vii.t7",
    "models/instance_norm/feathers.t7",
    "models/eccv16/la_muse.t7",
    "models/instance_norm/mosaic.t7",
    "models/eccv16/starry_night.t7",
    "models/instance_norm/the_scream.t7",
    "models/instance_norm/udnie.t7",
    "models/eccv16/the_wave.t7"
];*/

/*var rawBodyParser = bodyParser.raw({limit: '10mb'});

app.post("/render/:filterId",rawBodyParser, function (req, res) {
    var filterId = req.params.filterId;
    console.log("save bitmap to file ");
    if(req.body!=null && req.body!=undefined){
        var fileData = {image:req.body, filterId:filterId, path:"",fileId:"", resultPath:""};
        async.waterfall([
            function(callback) {
                saveBitmap(fileData,callback);
            }/!*,
            function(callback) {
                renderFile(fileData,callback);
            },
            function(callback){
                readResultFile(fileData,callback);
            }*!/
        ], function (error, success) {
            if (error) {
                console.log('Something is wrong!');
                res.status(400).send('Error');
                return;
            }
            console.log("Success");
            //res.send({path:fileData.resultPath,image:fileData.image});
            res.send("OK");
            return alert('Done!');
        });
    }

    res.status(400).send('invalid image data');
    return;
}*/

/*function readResultFile(fileData, callback){

}

function renderFile(fileData, callback){
    var outputPath = config.get('dataPath') + fileData.fileId + "_res.png";

    console.log("outputPath",outputPath);
    var params = [
        path.join(config.get('neuralStylePath'), 'fast_neural_style.lua'),
        '-model',getModelPath(fileData.modelId),
        '-input_image', fileData.path,
        '-output_image', outputPath,
        '-gpu', -1
    ];

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
    neuralStyle.stdout.on('data', function(data) {
        console.log(String(data));
        stdout += String(data);
        var isTaskCompleted = getIsTaskCompleted(stdout);
        if (isTaskCompleted) {
            //task.state = neuralStyleUtil.DONE;
           // sendTaskStatusEvent(task);
            neuralStyle.kill();
            return
        }

        if (task.state == neuralStyleUtil.CANCELLED) {
            neuralStyle.kill();
        }
    });

    neuralStyle.on('exit', function(code) {
        var isFailed = false;
        if (code != 0) {
            console.log('neural_style failed for id ' + task.id + ' with code ' + code + '\n' + neuralStyle.stderr.read());
            isFailed = true;
        }
    });

}*/

// save bitmap to file and return file path
/*function saveBitmap(fileData, callback){
    fileData.fileId = getUniqueId();
    fileData.path = config.get('dataPath') + fileData.fileId + ".jpg";
    fs.writeFile(fileData.path, fileData.image);
    callback(null,fileData);
}

function getModelPath(id){
    var modelId = Number(id);
    var modelPath = models[modelId-1];
    console.log("modelId = " + id + " " + modelId, modelPath);
    return config.get('neuralStylePath') + modelPath;
}

function getUniqueId (){
    return Math.round(Math.random()*Math.pow(10,16));
}

try {
    console.log("dataPath " + config.get('dataPath'));
    fs.mkdirSync(config.get('dataPath'));
} catch (ex) {
    if (ex.code != 'EEXIST') {
        throw ex;
    }
}*/


var server = app.listen(config.get('port'), function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Listening at http://%s:%s', host, port);
});