(function() {
    'use strict';

    angular.module('PrizmaDemo').config(ApplicationConfig);

    ApplicationConfig.$inject = ['$mdIconProvider', '$mdThemingProvider', '$compileProvider'];

    function ApplicationConfig ($mdIconProvider, $mdThemingProvider, $compileProvider) {
        $mdIconProvider.defaultIconSet('img/icons/default-set.svg', 128); // Register a default set of SVG icons
        $mdThemingProvider.theme('default').primaryPalette('indigo').accentPalette('pink').warnPalette('red').backgroundPalette('grey');
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|blob):/);
    }
})();