from api.command import APICommand
import domoticz

class GetDevices(APICommand):
    def execute(self, params):
        resp = self.adapter.devices()
        self.send_response(resp)

class GetStatus(APICommand):
    def execute(self, params):
        resp = self.adapter.status()
        self.send_response(resp)

class AddMonitor(APICommand):
    def execute(self, params):
        resp = self.adapter.addmonitor(params)
        self.send_response(resp)

class Info(APICommand):
    def execute(self, params):
        data = domoticz.get_plugin_parameters()
        self.send_response(data)