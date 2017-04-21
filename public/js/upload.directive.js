(function () {
    'use strict';

    angular
        .module('PrizmaDemo')
        .directive('upload', upload);

    upload.$inject = [];

    function upload() {
        return {
            restrict: 'E',
            link: function (scope, element) {
                var input = $(element[0].querySelector('#file-input'));
                var button = $(element[0].querySelector('#upload-button'));
                if (input.length && button.length) {
                    button.click(function () {
                        input.click();
                    });
                }
                input.on('click', _onClick);
                input.on('change', _onChange);

                function _onClick() {
                    input.prop("value", "");
                }
                function _onChange(e) {
                    if (e.target.files[0]) {
                        if (e.target.files[0].type.match('image.*')) {
                            scope.$broadcast('upload:success', e.target.files[0]);
                        } else {
                            scope.$broadcast('upload:fail', null);
                        }
                    }
                }
            }
        }
    }
})();