(function() {
    'use strict';

    angular
        .module('PrizmaDemo')
        .service('ApplicationService', ApplicationService);

    ApplicationService.$inject = ['$http', '$rootScope'];

    function ApplicationService() {
        this.downloadImage = downloadImage;
        this.resizeImage = resizeImage;
        this.uploadImage = uploadImage;

        function downloadImage (link) { // Works in Chrome, Firefox, Opera. Not works in IE, Safari.
            if (!link) return;

            var hyperlink = document.createElement('a');
            hyperlink.href = link;
            hyperlink.target = '_blank';
            hyperlink.download = 'image.png';
            document.body.appendChild(hyperlink);
            var evt = new MouseEvent('click', {view: window, bubbles: true, cancelable: true});
            hyperlink.dispatchEvent(evt);
            document.body.removeChild(hyperlink);
        }
        function resizeImage (src) { // src is base64 data url
            if (!src) return;
            var MAX_PIXELS = 1000000;
            var img = document.createElement("img");
            img.src = src;
            var iWidth = img.width,
                iHeight = img.height,
                iPixels = iWidth * iHeight;
            if (iPixels < MAX_PIXELS) return src;
            var factor = Math.sqrt(iPixels / MAX_PIXELS);
            var canvas = document.createElement('canvas');
            canvas.width = iWidth / factor;
            canvas.height = iHeight / factor;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL();
        }
        function uploadImage () {
            var reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = function () {
                $timeout(function () {
                    $scope.srcOriginal = reader.result;
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