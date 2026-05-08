define([
    'app',
    '../templates/logmonitor/viz',
    '../templates/logmonitor/viz.full.render',
    '../templates/logmonitor/leaflet',
    '../templates/logmonitor/logmonitor_devices',
    '../templates/logmonitor/logmonitor_status',
    'app/devices/Devices.js'
],
    function (app, Viz, vizRenderer, leaflet) {
        var viz = new Viz(vizRenderer);

        app.component('logmonitorPlugin', {
            templateUrl: 'app/logmonitor/index.html',
            controller: logmonitorPluginController
        });

        // Allows to load Devices.html which contains templates for <devices-table /> component
        app.component('logmonitorFakeDevices', {
            templateUrl: 'app/devices/Devices.html',
        });

        app.factory('logmonitor', function ($q, $rootScope, domoticzApi) {
            var requestsCount = 0;
            var requestsQueue = [];
            var deviceIdxDefer = $q.defer();
            var commandsQueue = $q.resolve();

            $rootScope.$on('device_update', function (e, device) {
                getControlDeviceIndex().then(function (deviceIdx) {
                    if (device.idx === deviceIdx) {
                        handleResponse(JSON.parse(device.Data))
                    }
                })
            });

            return {
                setControlDeviceIdx: setControlDeviceIdx,
                sendRequest: sendRequest,
            };

            function setControlDeviceIdx(idx) {
                deviceIdxDefer.resolve(idx);

                // In case idx was already resolved before
                deviceIdxDefer = $q.defer();
                deviceIdxDefer.resolve(idx);
            }

            function getControlDeviceIndex() {
                return deviceIdxDefer.promise;
            }

            function sendRequest(command, params) {
                return getControlDeviceIndex().then(function (deviceIdx) {
                    function sendDomoticzRequest() {
                        var deferred = $q.defer();
                        var requestId = ++requestsCount;

                        var requestInfo = {
                            requestId: requestId,
                            deferred: deferred,
                        };

                        requestsQueue.push(requestInfo);

                        domoticzApi.sendCommand('udevice', {
                            idx: deviceIdx,
                            svalue: JSON.stringify({
                                type: 'request',
                                requestId: requestId,
                                command: command,
                                params: params || {}
                            })
                        }).catch(function (error) {
                            deferred.reject(error);
                        });

                        return deferred.promise;
                    }

                    commandsQueue = commandsQueue.then(sendDomoticzRequest, sendDomoticzRequest)
                    return commandsQueue;
                });
            }

            function handleResponse(data) {
                if (data.type !== 'response' && data.type !== 'status') {
                    return;
                }

                var requestIndex = requestsQueue.findIndex(function (item) {
                    return item.requestId === data.requestId;
                });

                if (requestIndex === -1) {
                    return;
                }

                var requestInfo = requestsQueue[requestIndex];

                if (data.type === 'status') {
                    requestInfo.deferred.notify(data.payload);
                    return;
                }

                if (data.isError) {
                    requestInfo.deferred.reject(data.payload);
                } else {
                    requestInfo.deferred.resolve(data.payload);
                }

                requestsQueue.splice(requestIndex, 1);
            }
        });

        function logmonitorPluginController($element, $scope, Device, domoticzApi, dzNotification, logmonitor) {
            var $ctrl = this;

            $ctrl.selectPlugin = selectPlugin;
            $ctrl.getBackendStautsString = getBackendStautsString;
            $ctrl.getVersionString = getVersionString;
            $ctrl.fetchlogmonitorDevices = fetchlogmonitorDevices;
            $ctrl.refreshDomoticzDevices = refreshDomoticzDevices;

            $ctrl.$onInit = function () {
                $ctrl.selectedApiDeviceIdx = null;
                $ctrl.devices = [];

                fetchControllerInfo();

                refreshDomoticzDevices().then(function () {
                    $ctrl.pluginApiDevices = $ctrl.devices.filter(function (device) {
                        return device.Unit === 255
                    });

                    if ($ctrl.pluginApiDevices.length > 0) {
                        $ctrl.selectPlugin($ctrl.pluginApiDevices[0].idx);
                    }
                });

                $scope.$on('device_update', function (event, deviceData) {
                    var device = $ctrl.devices.find(function (device) {
                        return device.idx === deviceData.idx && device.Type === deviceData.Type;
                    });

                    if (device) {
                        Object.assign(device, deviceData);
                    }
                });
            };

            function selectPlugin(apiDeviceIdx) {
                $ctrl.selectedApiDeviceIdx = apiDeviceIdx;
                logmonitor.setControlDeviceIdx(apiDeviceIdx);

                $ctrl.controllerInfo = null;
                $ctrl.logmonitorDevices = null;

                fetchControllerInfo();
                fetchPluginInfo()
                fetchlogmonitorDevices();
            }

            function fetchlogmonitorDevices() {
                return logmonitor.sendRequest('getdevices').then(function (devices) {
                    $ctrl.logmonitorDevices = devices.map(function (device) {
                        return Object.assign({
                            ID: 'N/A'
                        }, device);
                    }).sort(function (a, b) {
                        return a.name < b.name ? -1 : 1
                    });
                });
            }

            function fetchControllerInfo() {
                return logmonitor.sendRequest('getstatus').then(function (data) {
                    $ctrl.controllerInfo = data.output;
                });
            }

            function fetchPluginInfo() {
                return logmonitor.sendRequest('plugin_info').then(function (data) {
                    $ctrl.pluginInfo = data;
                });
            }

            function getBackendStautsString() {
                if ($ctrl.controllerInfo.error) {
                    return `${$ctrl.controllerInfo.error}`;
                }
                return `${$ctrl.controllerInfo.BackendState}`;
            }

            function getVersionString() {
                var logmonitor = `v.${$ctrl.controllerInfo.Version}`;
                var plugin = `v.${$ctrl.pluginInfo.Version}`
                return `plugin: ${plugin}, logmonitor: ${logmonitor}`;
            }

            function refreshDomoticzDevices() {
                return domoticzApi.sendRequest({
                    type: 'command',
                    param: 'getdevices',
                    displayhidden: 1,
                    filter: 'all',
                    used: 'all'
                })
                    .then(domoticzApi.errorHandler)
                    .then(function (response) {
                        if (response.result !== undefined) {
                            $ctrl.devices = response.result
                                .filter(function (device) {
                                    return device.HardwareType === 'LogMonitor'
                                })
                                .map(function (device) {
                                    return new Device(device)
                                });
                        } else {
                            $ctrl.devices = [];
                        }
                    });
            }
        }
    });