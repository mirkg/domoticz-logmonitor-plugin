# Logmonitor Domoticz Plugin

## Overview

This Domoticz plugin allow to monitori logs streams and match specific patterns to update devices.

## Run

1. Clone repository into your domoticz plugins folder
```
cd domoticz/plugins
git clone https://github.com/mirkg/domoticz-logmonitor-plugin.git logmonitor
```
2. Restart domoticz
3. Make sure that "Accept new Hardware Devices" is enabled in Domoticz settings
4. Go to "Hardware" page and add new item with type "Logmonitor"
5. Go to "Custom" page and configure Logmonitor devices

## Adding devices

It is possible to monitor log file(s) by providing path pattern like
```
/opt/domoticz/logs/domoticz.log*
```
or use journalctl query like
```
-t kernel -n1000
```

## License

This project is licensed under the **MIT License**. Feel free to use it and modify it on your own fork.

## Contributing

Pull requests with fixes are welcome! New functionalities and extensions will be not discussed in this repository.
