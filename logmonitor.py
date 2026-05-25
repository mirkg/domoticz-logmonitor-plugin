
import domoticz
import re
import signal
import subprocess
import threading
import time
import traceback
from queue import Queue, Empty

class ProcessorThread(threading.Thread):

    def __init__(self, args=(), kwargs=None):
        super(ProcessorThread, self).__init__(args=args, kwargs=kwargs)
        self._stop = threading.Event()
        self.devid = kwargs['devid']
        self.dev_opts = kwargs['opts']
        self.timeout = kwargs['timeout']
        self.update_queue = args[0]
        self.error = ''
        self.process = None
        self._started_at = int(time.time())

    def started_at(self):
        return self._started_at

    def is_journal(self):
        return 'query' in self.dev_opts and self.dev_opts['query'] != ''

    def stop(self):
        domoticz.debug("stop: " + self.devid)
        self._stop.set()
        if self.process != None:
            if self.process.stdin.writable():
                try:
                    self.process.stdin.write('\x03'.encode())
                    self.process.stdin.flush()
                    self.process.send_signal(signal.SIGINT)
                    self.process.send_signal(signal.CTRL_C_EVENT)
                except:
                    pass
                self.process.kill()

    def stopped(self):
        return self._stop.is_set()

    def get_error(self):
        return self.error

    def validate_input(self, cmd):
        if cmd.find(';') > 0 or cmd .find('&') > 0:
            cmd = '>&2 echo "invalid characters in path or query [;&]"'
        return cmd

    def prepare_cmd(self):
        cmd = ''
        if 'path' in self.dev_opts:
            cmd = '/usr/bin/tail -n0 -f ' + self.dev_opts['path']
        elif 'query' in self.dev_opts:
            cmd = '/usr/bin/journalctl -n0 -f ' + self.dev_opts['query']
        cmd = self.validate_input(cmd)
        return cmd

    def run(self):
        try:
            cmd = self.prepare_cmd()
            regex = re.compile(r"" + self.dev_opts['regex'])

            self.process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
            #stdout, stderr = self.process.communicate(timeout=self.timeout)
            domoticz.debug("start: " + self.devid)

            #handle cmd stderr to self.error
            try:
                ret_code = self.process.wait(timeout=3)
                if not ret_code == None:
                    self.error = self.process.stderr.read().decode()
                    self.stop()
            except:
                pass
            #handle stdout as stream
            for line in iter(lambda: self.process.stdout.readline(), b""):
                if self.stopped():
                    break
                match = re.search(regex, line.decode())
                if not match == None:
                    domoticz.debug("found match for device: " + self.devid)
                    self.update_queue.put(self.devid)
            domoticz.debug("stopped: " + self.devid)
        except subprocess.TimeoutExpired:
            domoticz.debug("timeouted: " + self.devid)
        except Exception as ex:
            domoticz.debug('thread error with output=[' + str(traceback.format_exc().splitlines()) + ']')

class LogMonitor:

    device_name_prefix = 'logmonitor.'
    domoticz_unit = 1
    running = True

    def __init__(self, restart_interval):
        self.restart_interval = restart_interval
        self.last_restart = 0
        self.interval = 10
        self.ndevices = {}
        self.nextDeviceId = 0
        self.status = {'status': 'running'}
        self.threads = {}
        self.lock = threading.Lock()
        self.last_update = 0
        self.update_queue = Queue(maxsize=0)

    def start(self, devs):
        self.read_all_devices(devs)
        try:
            for devid in self.ndevices:
                self.threads[devid] = ProcessorThread(args=(self.update_queue,), kwargs={"devid": devid, "opts": self.ndevices[devid].Options, "timeout": self.restart_interval + 5})
            for t in self.threads.values():
                t.start()
        except Exception as ex:
            domoticz.error('start failed with output=[' + str(traceback.format_exc().splitlines()) + ']')

    def stop(self):
        LogMonitor.running = False
        try:
            for t in self.threads.values():
                t.stop()
            for t in self.threads.values():
                t.join(timeout=3)
        except Exception as ex:
            domoticz.debug('stop failed with output=[' + str(traceback.format_exc().splitlines()) + ']')

    def check_updates(self):
        now = int(time.time())
        #restart threads with interval
        if self.last_restart + self.restart_interval < now:
            self.last_restart = now
            domoticz.debug('restarting monitors threads')
            try:
                for devid in self.threads.keys():
                    if not self.threads[devid].is_journal():
                        self.threads[devid].stop()
                        #self.threads[devid].join(timeout=1)
                        self.threads[devid] = ProcessorThread(args=(self.update_queue,), kwargs={"devid": devid, "opts": self.ndevices[devid].Options, "timeout": self.restart_interval + 5})
                for t in self.threads.values():
                    if not t.is_journal():
                        t.start()
            except Exception as ex:
                domoticz.error('restart_monitors failed with output=[' + str(traceback.format_exc().splitlines()) + ']')

        now = int(time.time())
        # update values and stats from threads
        if self.last_update + self.interval < now:
            self.last_update = now
            domoticz.debug('updating stats')
            try:
                while not self.update_queue.empty():
                    try:
                        devid = self.update_queue.get(timeout=1)
                        self.update_device_string_value(devid, self.domoticz_unit)
                        self.update_queue.task_done()
                    except Empty:
                        pass
                self.status['status'] = 'running'
                for devid in self.threads:
                    stat = 'running ' + str(now - self.threads[devid].started_at()) + ' seconds'
                    if self.threads[devid].stopped():
                        stat = 'error: ' + self.threads[devid].get_error()
                        self.status['status'] = 'error'
                    with self.lock:
                        self.status[devid] = stat
            except Exception as ex:
                domoticz.error('check_updates failed with output=[' + str(traceback.format_exc().splitlines()) + ']')

    def getstatus(self):
        try:
            with self.lock:
                return self.status
        except Exception as ex:
            domoticz.error('getstatus failed with output=[' + str(traceback.format_exc().splitlines()) + ']')

    def update_device_string_value(self, id, value):
        with self.lock:
            dev = self.ndevices[id]
            dev.sValue = str(value)
            dev.Update(Log=True)
            self.ndevices[id] = dev

    def create_domoticz_dev(self, dev):
        domoticz.debug('creating device: ' + str(dev))
        device = domoticz.get_device(str(dev['id']), self.domoticz_unit)
        if device == None:
            device = domoticz.create_device(
                Unit=1,
                DeviceID=str(dev['id']),
                Name=dev['name'],
                TypeName=dev['type'],
            )
            domoticz.debug('new device: ' + str(device))
            if not dev['stype'] == None:
                device.SwitchType = dev['stype']
                device.Update(UpdateProperties=True)
            opts = {}
            opts.update(dev['opts'])
            device.Options = opts
            device.Update(UpdateOptions=True)
            domoticz.debug('new device opts: ' + str(device.Options))
        return device

    def get_domoticz_dev(self, dev_id):
        device = domoticz.get_device(str(dev_id), self.domoticz_unit)
        if device == None:
            raise Exception('device not found')
        return device

    def read_all_devices(self, devs):
        try:
            for name in devs:
                if str(name) == 'api_transport':
                    continue

                dev = devs[name]
                devid = str(dev.DeviceID)
                domoticz.debug("device ID:       '" + str(devid) + "'")
                domoticz.debug("device options:  '" + str(dev.Units[self.domoticz_unit].Options) + "'")
                idnum = int(devid)
                if idnum >= self.nextDeviceId:
                    self.nextDeviceId = idnum + 1
                self.ndevices[devid] = self.get_domoticz_dev(idnum)
                domoticz.debug('read dev: ' + str(self.ndevices[devid]))
        except Exception as ex:
            domoticz.error('error read_all_devices: ' + str(name) + ':' + devid + ' -> ' + str(traceback.format_exc().splitlines()))

    def devices(self):
        devs = []
        #keys = ['ID', 'Name' 'LogPath', 'Query', 'Regex', 'LastUpdate', 'Value']
        try:
            for devid in self.ndevices:
                ndev = {}
                ndev['ID'] = str(devid)
                ndev['Name'] = str(self.ndevices[devid].Name)
                opts = self.ndevices[devid].Options
                ndev['LogPath'] = str(opts.get('path', ''))
                ndev['Query'] = str(opts.get('query', ''))
                ndev['Regex'] = str(opts.get('regex', ''))
                ndev['LastUpdate']= str(self.ndevices[devid].LastUpdate)
                ndev['Value'] = str(self.ndevices[devid].sValue)
                devs.append(ndev)
        except Exception as ex:
            domoticz.debug('devices failed with output=[' + str(traceback.format_exc().splitlines()) + ']')
            return {'resp': 'failed', 'error': str(ex)}
        return devs

    def addmonitor(self, params):
        #{'path': '/opt/domoticz/logs/domoticz.log', 'regex': 'logmonitor:', 'query': '-t kernel'}
        if not 'path' in params:
            params['path'] = ''
        if not 'regex' in params:
            params['regex'] = ''
        if not 'query' in params:
            params['query'] = ''
        domoticz.debug('addmonitor: ' + str(params))
        try:
            opts = {'path': str(params['path']), 'query': str(params['query']), 'regex': str(params['regex'])}
            #opts['DisableLogAutoUpdate'] = 'true'
            devid = str(self.nextDeviceId)
            ndev = {'id': devid, 'name': self.device_name_prefix + params['name'], 'type': 'Counter Incremental', 'stype':3, 'opts': opts}
            with self.lock:
                self.ndevices[devid] = self.create_domoticz_dev(ndev)
                self.nextDeviceId += 1
            self.threads[devid] = ProcessorThread(args=(self.update_queue,), kwargs={"devid": devid, "opts": self.ndevices[devid].Options, "timeout": self.restart_interval + 5})
            self.threads[devid].start()
        except Exception as ex:
            domoticz.debug('addmonitor failed with output=[' + str(traceback.format_exc().splitlines()) + ']')
            return {'resp': 'failed', 'error': str(ex)}

    def deletemonitor(self, params):
        try:
            domoticz.debug('deletemonitor: ' + str(params))
            devid = params['device']['ID']
            with self.lock:
                del self.ndevices[devid]
                self.threads[devid].stop()
                self.threads[devid].join(timeout=3)
                del self.threads[devid]
                del self.status[devid]
            if params['removeDomoticzDevices']:
                domoticz.remove(devid, self.domoticz_unit)
            return {'status': 'ok'}
        except Exception as ex:
            domoticz.debug('deletemonitor failed with output=[' + str(traceback.format_exc().splitlines()) + ']')
            return {'error': str(ex)}

    def resetmonitor(self, params):
        try:
            domoticz.debug('resetmonitor: ' + str(params))
            devid = params['ID']
            val = int(self.ndevices[devid].sValue)
            self.update_device_string_value(devid, -val)
            return {'status': 'ok'}
        except Exception as ex:
            domoticz.debug('resetmonitor failed with output=[' + str(traceback.format_exc().splitlines()) + ']')
            return {'error': str(ex)}

    def updatemonitor(self, params):
        try:
            domoticz.debug('updatemonitor: ' + str(params))
            devid = params['device']['ID']
            new_opts = {'path': str(params['path']), 'query': str(params['query']), 'regex': str(params['regex'])}
            name = str(params['name'])
            self.threads[devid].stop()
            self.threads[devid].join(timeout=3)
            with self.lock:
                dev = self.ndevices[devid]
                if not name == params['device']['Name']:
                    dev.Name = name
                    dev.Update(UpdateProperties=True)
                    self.ndevices[devid] = dev
                if not new_opts['path'] == params['device']['LogPath'] or not new_opts['query'] == params['device']['Query'] or not new_opts['regex'] == params['device']['Regex']:
                    opts = dev.Options
                    opts.update(new_opts)
                    dev.Options = opts
                    dev.Update(UpdateOptions=True)
                    self.ndevices[devid] = dev
                    domoticz.debug('new device opts: ' + str(dev.Options))
            self.threads[devid] = ProcessorThread(args=(self.update_queue,), kwargs={"devid": devid, "opts": self.ndevices[devid].Options})
            self.threads[devid].start()
            return {'status': 'ok'}
        except Exception as ex:
            domoticz.debug('updatemonitor failed with output=[' + str(traceback.format_exc().splitlines()) + ']')
            return {'error': str(ex)}
