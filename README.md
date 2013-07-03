github-hook-reciever
====================

github-hook-reciever is a simple node.js script to handle github hooks in node.js on unix.
It can be used to do any tasks, but it is perfect for deploying simple projects.

Installation
======

git clone git@github.com:jdponomarev/node-github-hook.git

Configuration
======

github-hook-reciever is configured via json config files.
The default config is config/config.json, but you can pass an another config path as an argument.
Example:
node node-github-hook/index.js /etc/github-hook-config.json

Config contains a port number to run node on and a list of jobs.
A Job is a list of tasks with prerequisites.
Job defines what to do and when to do.

### WHAT
What is an array of tasks that should be run.
Tasks by default are located in tasks/
Task can be a bash script, a js file, or a command.
Bash script is a simple bash script.
JS task is a node.js module which recieves all the data about the task and the commit, checkout tasks/example_task.js
A command is executed if no bash script or .js file found.

You can also pass some addtional data into a task:
```javascript
tasks:[{
	cwd:"/home/www",
	name:"task.js"
}]
```
CWD is used  for overriding the default directory of the task. More options are coming in the following releases.

### WHEN
When decides if the job should be executed or not.
Using when you can check all the parameters from the data sent to you by github.

Example:
Executing the job only if the pusher name is "jdponomarev".
```javascript
"when":{
  "pusher.name":"jdponomarev"
}
```
More complex example:
Executing the job only if the pusher name = jdponomarev and
repository name is test-repo and
branch name is test
and commit message contains "backup" and "release"
```javascript
"when":{
  "pusher.name":"jdponomarev",
  "repository.name":"test-repo",
  "ref":"refs/heads/test",
  "head_commit.message":{
    "type":"contains",
    "value":"release"
  },
  "head_commit.message":{
    "type":"contains",
    "value":"backup"
}
```
Currently When can only check if commit has complete equality or contains some fields.
In the following releases more features will be added.




Here is a sample full config file:
```javascript
{
  "port":8005,
	"jobs":[
		{
			"name":"pull_code_and_backup",
			"when":{
				"repository.pusher.name":"jdponomarev",
        "head_commit.message":{
          "type":"contains",
          "value":"backup"
        }
			},
			"what":[
				"mongo_backup.sh",
				"cd /home/www/myproject/ && git checkout master && git reset --hard HEAD && git pull origin master"
			]
		}
	]
}
```

Running
======
I suggest you to run github-hook-reciever using forever.
Here is an example on how to do this.
```bash
forever start --append -l /var/log/node/github_hook.log -o /var/log/node/github_hook.log -e /var/log/node/github_hook.log -w --watchDirectory /www/node-github-hook/ /www/node-github-hook/index.js
```


