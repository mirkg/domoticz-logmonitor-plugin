from api.command import APICommand
import domoticz

class Info(APICommand):
    def execute(self, params):
        data = domoticz.get_plugin_parameters()
        self.send_response(data)

class GetDevices(APICommand):
    def execute(self, params):
        resp = self.adapter.devices()
        self.send_response(resp)

class GetStatus(APICommand):
    def execute(self, params):
        resp = self.adapter.getstatus()
        self.send_response(resp)

class AddMonitor(APICommand):
    def execute(self, params):
        resp = self.adapter.addmonitor(params)
        self.send_response(resp)

class DeleteMonitor(APICommand):
    def execute(self, params):
        resp = self.adapter.deletemonitor(params)
        self.send_response(resp)

class ResetMonitor(APICommand):
    def execute(self, params):
        resp = self.adapter.resetmonitor(params)
        self.send_response(resp)

class UpdateMonitor(APICommand):
    def execute(self, params):
        resp = self.adapter.updatemonitor(params)
        self.send_response(resp)
