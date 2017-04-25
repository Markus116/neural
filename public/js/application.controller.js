(function() {
    'use strict';

    angular
        .module('PrizmaDemo')
        .controller('ApplicationController', ApplicationController);

    ApplicationController.$inject = ['$http', '$scope', '$timeout', '$mdSidenav', 'ApplicationService'];

    function ApplicationController ($http, $scope, $timeout, $mdSidenav, ApplicationService) {
        //var server = ' http://56f26a88.ngrok.io';
        var server = ' http://35.157.105.85';

        $scope.filter = null; // Currently chosen filter id
        $scope.filters = [
            {name:"Candy", src: 'img/filters/candy.jpg', id:1},
            {name:"Composition", src: 'img/filters/composition_vii.jpg', id:2},
            {name:"Feathers", src: 'img/filters/feathers.jpg', id:3},
            {name:"La-Muse", src: 'img/filters/la_muse.jpg', id:4},
            {name:"Mosaic", src: 'img/filters/mosaic.jpg', id:5},
            {name:"Starry Night", src: 'img/filters/starry_night.jpg', id:6},
            {name:"The Scream", src: 'img/filters/the_scream.jpg', id:7},
            {name:"Udnie", src: 'img/filters/udnie.jpg', id:8},
            {name:"Wave", src: 'img/filters/wave.jpg', id:9},
			{name:"Watercolor Blue", src: 'img/filters/blue.jpg', id:10},
            {name:"Warhol", src: 'img/filters/warhol.jpg', id:11},
            {name:"Watercolor", src: 'img/filters/watercolor-portrait.jpg', id:12},
            {name:"Vangogh", src: 'img/filters/vangogh.jpg', id:13},
            {name:"Bedroom at Arles", src: 'img/filters/the_bedroom_at_arles.jpg', id:14},
            {name:"Tintin", src: 'img/filters/tintin.jpg', id:15},
            {name:"Nijntje", src: 'img/filters/nijntje.jpg', id:16},
            {name:"Night Fantasy", src: 'img/filters/night_fantasy.jpg', id:17},
        ];
        $scope.isInProgress = false;
        $scope.srcLink = null; // Link to image on server
        $scope.srcOriginal = null; // Originally uploaded image source
        $scope.srcProcessed = null; // Processed image source

        $scope.applyFilter = applyFilter;
        $scope.downloadImage = downloadImage;
        $scope.selectFilter = selectFilter;
        $scope.toggleSidenav = toggleSidenav;

        $scope.$on('upload:success', _onUploadSuccess);

        function applyFilter () {
            $scope.isInProgress = true;
            $http({
                method: 'POST',
                url: server + '/render/',
                data: {
                    filterId: $scope.filter, // id
                    image: $scope.srcOriginal // base64
                }
            }).then(function(response) { // success
                $timeout(function () {
                    $scope.srcProcessed = response.data.image;
                    $scope.srcLink = server + response.data.path;
                    $scope.isInProgress = false;
                });
            }, function(response) { // failed
                console.warn('Filter apply failed.', response);
                $timeout(function () {
                    $scope.isInProgress = false;
                });
            });
        }
        function downloadImage (link) {
            ApplicationService.downloadImage(link);
        }
        function selectFilter (id) {
            $timeout(function () {
                $scope.filter = id;
            });
        }
        function toggleSidenav () {
            $mdSidenav('left').toggle();
        }
        function _onUploadSuccess (e, file) {
            var reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function () {
                $timeout(function () {
                    $scope.srcOriginal = ApplicationService.resizeImage(reader.result);
                    $scope.srcProcessed = null;
                    $scope.srcLink = null;
                });
            };
            reader.onerror = function (error) {
                console.warn('Image upload failed.', error);
            };
        }
    }
})();