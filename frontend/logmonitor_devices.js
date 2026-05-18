define(['app', 'app/devices/Devices.js'], function(app) {

    var addLogModal = {
        templateUrl: 'app/logmonitor/addLogModal.html',
        controllerAs: '$ctrl',
        controller: function($scope, logmonitor) {
            var $ctrl = this;

            $ctrl.createLogMonitor = function() {
                $ctrl.isSaving = true;

                logmonitor.sendRequest('addmonitor', {
                    name: $ctrl.name,
                    path: $ctrl.filePath,
                    regex: $ctrl.regex,
                    query: $ctrl.query,
                }).then(function() {
                    $scope.$close();
                });
            }
        }
    };

    var deviceUpdateModal = {
        templateUrl: 'app/logmonitor/deviceUpdateModal.html',
        controllerAs: '$ctrl',
        controller: function($scope, logmonitor) {
            var $ctrl = this;
            $ctrl.device = $scope.device;
            $ctrl.name = $ctrl.device.Name;
            $ctrl.filePath = $ctrl.device.LogPath;
            $ctrl.regex = $ctrl.device.Regex;
            $ctrl.query = $ctrl.device.Query;

            $ctrl.updateLogMonitor = function() {
                $ctrl.isSaving = true;

                logmonitor.sendRequest('updatemonitor', {
                    device: $ctrl.device,
                    name: $ctrl.name,
                    path: $ctrl.filePath,
                    regex: $ctrl.regex,
                    query: $ctrl.query,
                }).then(function() {
                    $scope.$close();
                });
            }
        }
    };

    var deviceRemoveModal = {
        templateUrl: 'app/logmonitor/deviceRemoveModal.html',
        controllerAs: '$ctrl',
        controller: function($scope, logmonitor, bootbox) {
            var $ctrl = this;
            $ctrl.device = $scope.device;
            $ctrl.removeDomoticzDevices = true;

            $ctrl.removeDevice = function() {
                $ctrl.isSaving = true;

                logmonitor.sendRequest('deletemonitor', {
                    device: $ctrl.device,
                    removeDomoticzDevices: $ctrl.removeDomoticzDevices
                }).then(function() {
                    $scope.$close();
                }).catch(function(error) {
                    $ctrl.isSaving = false;
                    bootbox.alert(error);
                });
            }
        }
    };

    app.component('logmonitorDevices', {
        bindings: {
            logmonitorDevices: '<',
            domoticzDevices: '<',
            onUpdate: '&',
            onUpdateDomoticzDevice: '&',
        },
        templateUrl: 'app/logmonitor/devices.html',
        controller: logmonitorDevicesController
    });

    app.component('logmonitorDevicesTable', {
        bindings: {
            devices: '<',
            onSelect: '&',
            onUpdate: '&'
        },
        template: '<table id="logmonitor-devices" class="display" width="100%"></table>',
        controller: logmonitorDevicesTableController,
    });

    function logmonitorDevicesController($scope, $rootScope, $uibModal, logmonitor) {
        var $ctrl = this;

        $ctrl.selectlogmonitorDevice = selectlogmonitorDevice;

        $ctrl.$onInit = function() {
            $ctrl.associatedDevices = []
        };
        $ctrl.$onChanges = function(changes) {
            if (changes.domoticzDevices) {
                $ctrl.selectlogmonitorDevice($ctrl.selectedlogmonitorDevice)
            }
            $rootScope.$broadcast('refresh');
        };
        $ctrl.addLogMonitor = addLogMonitor;

        function selectlogmonitorDevice(logmonitorDevice) {
            $ctrl.selectedlogmonitorDevice = logmonitorDevice;

            if (!logmonitorDevice) {
                $ctrl.associatedDevices = []
            } else {
                $ctrl.associatedDevices = $ctrl.domoticzDevices.filter(function(device) {
                    return device.ID.indexOf(logmonitorDevice.ieee_address) === 0;
                });
            }
        }

        function addLogMonitor() {
            $uibModal
                .open(Object.assign({}, addLogModal)).result
                .then($ctrl.onUpdate);
        }
    }

    function logmonitorDevicesTableController($element, $scope, $timeout, $uibModal, logmonitor, bootbox, dzSettings, dataTableDefaultSettings) {
        var $ctrl = this;
        var table;

        $ctrl.$onInit = function() {
            table = $element.find('table').dataTable(Object.assign({}, dataTableDefaultSettings, {
                order: [[0, 'asc']],
                columns: [
                    { title: 'ID', data: 'ID' },
                    { title: 'Name', data: 'Name' },
                    { title: 'LogPath', width: '150px', data: 'LogPath' },
                    { title: 'Query', width: '150px', data: 'Query' },
                    { title: 'Regex', data: 'Regex' },
                    { title: 'LastUpdate', data: 'LastUpdate' },
                    { title: 'Value', data: 'Value' },
                    {
                        title: '',
                        className: 'actions-column',
                        width: '80px',
                        orderable: false,
                        render: actionsRenderer
                    },
                ],
            }));

            table.on('click', '.js-restart-device-counter', function() {
                var device = table.api().row($(this).closest('tr')).data();

                return logmonitor.sendRequest('resetmonitor', device)
                    .then(function() {
                        //$scope.$close();
                    })
                    .catch(function(error) {
                        bootbox.alert(error);
                    });

                $scope.$apply();
                return false;
            });

            table.on('click', '.js-update-device', function() {
                var row = table.api().row($(this).closest('tr')).data();
                var scope = $scope.$new(true);
                scope.device = row;

                $uibModal
                    .open(Object.assign({ scope: scope }, deviceUpdateModal)).result
                    .then($ctrl.onUpdate);

                $scope.$apply();
                return false;
            })

            table.on('click', '.js-remove-device', function() {
                var row = table.api().row($(this).closest('tr')).data();
                var scope = $scope.$new(true);
                scope.device = row;
                scope.removeDomoticzDevices = true;

                $uibModal
                    .open(Object.assign({ scope: scope }, deviceRemoveModal)).result
                    .then($ctrl.onUpdate);

                $scope.$apply();
                return false;
            })

            table.on('select.dt', function(event, row) {
                $ctrl.onSelect({ device: row.data() });
                $scope.$apply();
            });

            table.on('deselect.dt', function() {
                //Timeout to prevent flickering when we select another item in the table
                $timeout(function() {
                    if (table.api().rows({ selected: true }).count() > 0) {
                        return;
                    }

                    $ctrl.onSelect({ device: null });
                });

                $scope.$apply();
            });

            render($ctrl.devices);
        };

        $ctrl.$onChanges = function(changes) {
            if (changes.devices) {
                render($ctrl.devices);
            }
        };

        function render(items) {
            if (!table || !items) {
                return;
            }

            table.api().clear();
            table.api().rows
                .add(items)
                .draw();
        }

        function jsonRenderer(data, type, row) {
            return JSON.stringify(data);
        }

        function actionsRenderer(data, type, row) {
            var actions = [];
            actions.push('<button class="btn btn-icon js-restart-device-counter" title="' + $.t('Restart counter') + '"><img src="images/restart.png" /></button>');
            actions.push('<button class="btn btn-icon js-update-device" title="' + $.t('Edit') + '"><img src="images/rename.png" /></button>');
            actions.push('<button class="btn btn-icon js-remove-device" title="' + $.t('Remove') + '"><img src="images/delete.png" /></button>');
            return actions.join('&nbsp;');
        }
    }
});