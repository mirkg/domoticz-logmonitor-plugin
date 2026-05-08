import domoticz


class APICommand():
    def __init__(self, adapter, request_id, on_command):
        self.adapter = adapter
        self.request_id = request_id
        self.execute_command = on_command

    def send_update(self, payload):
        self.execute_command('send_update', {
            'request_id': self.request_id,
            'payload': payload
        })

    def send_response(self, payload):
        self.execute_command('send_response', {
            'request_id': self.request_id,
            'payload': payload
        })

    def send_error(self, payload):
        self.execute_command('send_error', {
            'request_id': self.request_id,
            'payload': payload
        })

    def execute(self, params):
        domoticz.error('Command is not implemented')
