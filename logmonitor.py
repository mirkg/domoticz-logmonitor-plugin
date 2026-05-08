
import subprocess
import json
import domoticz
import traceback
from time import time

class LogMonitor:

    last_update = 0

    def __init__(self):
        self.interval = 60
        self.ndevices = {}

    def start(self):
        pass

    def stop(self):
        pass

    def run_request(self, args, command):
        cmd = " ".join(args)
        try:
            output = subprocess.check_output(self.cmd_path + command + " " + cmd, stderr=subprocess.STDOUT, shell=True)
            return {'resp': 'executed: ' + cmd, 'output': json.loads(output)}
        except Exception as ex:
            domoticz.debug('failed: ' + cmd +  ' with output=[' + str(traceback.format_exc().splitlines()) + ']')
            return {'resp': 'failed: ' + cmd, 'error': str(ex)}

    def check_updates(self):
        #TODO check if all logs streams are open
        now = int(time())
        if self.last_update + self.interval < now:
            pass

    def process_devices(self, status):
        ndev = {'id': 'backend_state', 'name':'BackendState', 'type': 'Text'}
        if not ndev['id'] in self.ndevices:
            self.ndevices[ndev['id']] = self.create_domoticz_dev(ndev)
        self.update_device_string_value(ndev['id'], status['BackendState'])

    def update_device_string_value(self, id, value):
        dev = self.ndevices[id]
        dev.sValue = str(value)
        dev.Update(Log=True)
        self.ndevices[id] = dev

    def create_domoticz_dev(self, dev):
        domoticz.debug('creating device: ' + str(dev))
        device = domoticz.get_device(dev['id'], 1)
        if device == None:
            device = domoticz.create_device(
                Unit=1,
                DeviceID=dev['id'],
                Name=dev['name'],
                TypeName=dev['type']
            )
        return device

    def devices(self):
        devs = []
        ret = self.run_request(['status', '--json'])
        if not 'error' in ret:
            keys = ['ID', 'LogPath', 'Regex']
            ndev = {}
            d = ret['output']['Self']
            for key in keys:
                ndev[key] = d[key]
            devs.append(ndev)
        return devs

    def addmonitor(self, params):
        domoticz.debug('addmonitor: ' + str(params))
        #TODO

    def status(self):
        return self.ndevices
