define(['app', 'app/devices/Devices.js'], function(app) {

    var addLogModal = {
        templateUrl: 'app/logmonitor/addLogModal.html',
        controllerAs: '$ctrl',
        controller: function($scope, logmonitor) {
            var $ctrl = this;

            $ctrl.createLogMonitor = function() {
                $ctrl.isSaving = true;

                logmonitor.sendRequest('addmonitor', {
                    path: $ctrl.filePath,
                    regex: $ctrl.regex,
                }).then(function() {
                    $scope.$close();
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

    function logmonitorDevicesController($scope, $uibModal, logmonitor) {
        var $ctrl = this;

        $ctrl.selectlogmonitorDevice = selectlogmonitorDevice;

        $ctrl.$onInit = function() {
            $ctrl.associatedDevices = []
        };
        $ctrl.$onChanges = function(changes) {
            if (changes.domoticzDevices) {
                $ctrl.selectlogmonitorDevice($ctrl.selectedlogmonitorDevice)
            }
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
                    { title: 'LogPath', width: '150px', data: 'LogPath' },
                    { title: 'Regex', data: 'Regex' },
                ],
            }));

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
    }
});