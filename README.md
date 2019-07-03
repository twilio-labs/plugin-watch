@twilio-labs/plugin-watch
=========================

Access and stream your Twilio debugger logs along with your calls and messages.

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @twilio-labs/plugin-watch
$ twilio COMMAND
running command...
$ twilio (-v|--version|version)
@twilio-labs/plugin-watch/1.0.0 win32-x64 node-v12.4.0
$ twilio --help [COMMAND]
USAGE
  $ twilio COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`twilio watch`](#twilio-watch)

## `twilio watch`

Show a list of log events generated for the account

```
USAGE
  $ twilio watch

OPTIONS
  -l=(debug|info|warn|error|none)           [default: info] Level of logging messages.
  -o=(columns|json|tsv)                     [default: columns] Format of command output.
  -p, --project=project                     Shorthand identifier for your Twilio project.
  -s, --streaming                           Continuously stream incoming log events
  --end-date=end-date                       Only show log events on or before this date
  --log-level=(error|warning|notice|debug)  Only show log events for this log level

  --properties=properties                   [default: dateCreated, logLevel, errorCode, alertText] The event properties
                                            you would like to display (JSON output always shows all properties)

  --start-date=start-date                   Only show log events on or after this date

DESCRIPTION
  Argg, this is only a subset of the log events and live tailing isn't quite ready! Think this is a killer feature? Let 
  us know here: https://bit.ly/twilio-cli-feedback
```

_See code: [src\commands\watch.js](https://github.com/twilio-labs/plugin-watch/blob/v1.0.0/src\commands\watch.js)_
<!-- commandsstop -->
