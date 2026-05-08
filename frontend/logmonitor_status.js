define(['app', 'ace', 'ace-language-tools'], function(app) {
    app.component('logmonitorStatus', {
        templateUrl: 'app/logmonitor/logmonitorStatus.html',
        controller: logmonitorStatusController
    })

    function logmonitorStatusController($scope, $rootScope, $element, bootbox, logmonitor) {
        var $ctrl = this;
        var aceEditor;

        $ctrl.isModified = false;
        $ctrl.$onInit = function() {
            fetchStatus();
        }

        $rootScope.$on('refresh', function (e) {
            fetchStatus();
        });

        function fetchStatus() {
            return logmonitor.sendRequest('getstatus').then(function(status) {
                $ctrl.status = status;

                var element = $element.find('.js-script-content')[0];
                aceEditor = ace.edit(element);

                aceEditor.setOptions({
                    enableBasicAutocompletion: true,
                    enableSnippets: true,
                    enableLiveAutocompletion: true
                });

                ace.config.setModuleUrl("ace/mode/json", "/templates/logmonitor/ace_json_mode.js");
                ace.config.setModuleUrl("ace/mode/json_worker", "/templates/logmonitor/ace_worker_json.js");
                aceEditor.setTheme('ace/theme/xcode');
                aceEditor.setValue(JSON.stringify(status, null, '\t'));
                aceEditor.resize();
                aceEditor.getSession().setMode('ace/mode/json');
                aceEditor.$blockScrolling = Infinity;
                aceEditor.gotoLine(1);
                aceEditor.scrollToLine(1, true, true);
            }).catch(function() {
                bootbox.alert('Failed to load Status');
            })
        }
    }
});