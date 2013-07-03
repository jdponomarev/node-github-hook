var http = require('http');
var Querystring=require("querystring");
var util = require('util');
var exec = require('child_process').exec;
var config;
var jobs=[];
var fs=require("fs");
var tasksDir=__dirname+"/tasks/";
var globalTasksDir=__dirname+"/tasks/";
//Loading default config
if(process.argv[2]==null){
	config=require(__dirname + '/config/config.json');
}else{
	
	try{
		
		config=require(__dirname + process.argv[2]);
	}catch(e){
		console.log("failed to load config from "+process.argv[2]+", falling back to default config");
		config=require(__dirname + '/config/config.json');
	}
}

//Setting port from config, default is 8005
var nodePort=config.port||8005;

var node = http.createServer(function(req, res) {
	if (req.method === 'GET'){
		return request.connection.destroy();
	}else if(req.method==="POST"){
		var body = '';
		req.on('data', function (data) {
			body += data;
			if (body.length > 1e6) {
				console.log("nuke request, destroying.");
				req.connection.destroy();
			}
		});	
		req.on('end', function() {
			var request_params={};
			try{
				request_params = Querystring.parse(body);
			}catch(e){
				console.log("failed to parse github request: "+e);
				return;
			}

			try{
				request_params=request_params["payload"];
				request_params=JSON.parse(request_params);
			}catch(e){
				console.log("failed to parse github payload: "+e);
				return;
			}
			requestHandler(request_params,function(){
				res.writeHead(200);
				res.end("ok");
			});
		});
	}
}).listen(nodePort);


//Loading jobs from the config
if(config.jobs instanceof Array){
	console.log("loading "+config.jobs.length+" jobs");
	jobs=jobs.concat(config.jobs);
}

var requestHandler=function(commit_data,callback){
	console.log("commit_data=");
	console.dir(commit_data);

	if(jobs.length===0){
		console.log("no jobs, finishing");
		callback();
		return;
	}
	(function jobRunner(jobs,job_id){
		runJob(jobs[job_id],commit_data,function(result){
			if(++job_id<jobs.length){
				//Setting global taskDir to jobs cwd if exists;
				tasksDir=jobs[job_id].cwd||globalTasksDir;
				jobRunner(jobs,job_id);
			}else{
				console.log("all jobs done");
				callback();
			}
		});
	})(jobs,0);

	
};


var runJob=function(job,commit_data,callback){
	if(checkJobPrereqs(job,commit_data)===true){
		doJob(job,commit_data,function(){
			callback();
		});
	}else{
		callback();
	}
};


var checkJobPrereqs=function(job,commit_data){
	console.dir(job);
	
	for(var i in job.when){
		if(jobDeepChecker(i,job.when[i],commit_data)===false){
			return false;
		}
	}
	return false;
};
var jobDeepChecker=function(prereq,prereq_target,commit_data){
	//console.log("prereq="+prereq+"   prereq_target="+prereq_target+" "+JSON.stringify(commit_data));
	var prereqs_array=prereq.split(".");
	var current_data=commit_data;
	//console.log("prereqs_array="+JSON.stringify(prereqs_array));
	try{
		for(var i=0;i<prereqs_array.length;i++){
			current_data=current_data[prereqs_array[i]];
		}		

		if(typeof prereq_target==="string"){	
			if(current_data!=prereq_target){
				console.log("checking task prereq "+prereq+"="+prereq_target+"  failed");
				return false;
			}else{
				console.log("checking task prereq "+prereq+"="+prereq_target+"  ok.");
				return true;
			}
		}else{
			console.log("complex prereq");
			if(prereq_target.type==="contains"){
				if(current_data.indexOf(prereq_target.value)!==-1){
					console.log("checking task prereq "+prereq+"="+prereq_target+"  ok.");
					return true;
				}else{
					console.log("checking task prereq "+prereq+"="+prereq_target+"  failed");
					return false;
				}
			}else{
				console.log("checking task prereq "+prereq+"="+prereq_target+"  failed, unknown complex type.");
				return false;
			}
		}

	}catch(e){
		console.log("checking task prereq "+prereq+"="+prereq_target+"  failed with error: "+e);
		return false;
	}
}

var doJob=function(job,commit_data,callback){
	console.log("doing job "+JSON.stringify(job));
	if((job.what==null)||(job.what.length===0)){
		console.log("no tasks in this job, exiting");
		callback();
	}
	var tasks=job.what;

	(function taskRunner(tasks,task_id){
		runTask(tasks[task_id],commit_data,job,function(result){
			if(++task_id<tasks.length){
				taskRunner(tasks,task_id);
			}else{
				callback();
			}
		});
	})(tasks,0);
	
};

var runTask=function(task,commit_data,job,callback){
	console.log("\n\n\n");
	console.log("running task = "+JSON.stringify(task));

	var taskDir=task.cwd||tasksDir;
	var task_name=task.name||task;

	var js_regexp=/.+(\.js)$/;
	var sh_regexp=/.+(\.(sh|bash))$/;

	

	fs.exists(taskDir+task_name, function (exists) {
		if(exists===true){
			//console.log("files exists, ok!");
			if(js_regexp.test(task_name)===true){
				//console.log(task_name+" is a .js task");
				var js_module=require(taskDir+task_name);
				js_module(task,commit_data,job,function(err,result){
					if(err==null){
						callback({res:"ok"});
					}else{
						callback({res:"err",descr:"error in running js module "+task_name});
					}
				});
			}else if(sh_regexp.test(task_name)===true){
				console.log(task_name+" is a shell task");
				exec('bash '+taskDir+task_name, {
						cwd : taskDir
				},function (error, stdout, stderr) {
					if(error!=null){
						callback({res:"err",descr:"error in task "+task_name+": "+error});
					}else{
						console.log("stdout="+stdout);
						callback({res:"ok"});
					}
					
				});		
			}else{
				callback({res:"err",descr:"error in task "+task_name+": "+error});
			}	
		}else{
			console.log("task "+task_name+" does not exist, trying to execute as a shell command.");
			exec(task_name, {
					cwd : taskDir
			},function (error, stdout, stderr) {
				if(error!=null){
					console.log("error in task "+task_name+": "+error);
					callback({res:"err",descr:"error in task "+task_name+": "+error});
				
				}else{
					console.log("stdout="+stdout);
					callback({res:"ok"});
				}
				//console.log("error = "+error+"   stdout="+stdout+"     stderr="+stderr);
			});					
		}
	});
};



/*
var node = http.createServer(function(req, res) {
		var req_url={};
		console.log("request!");
		if(req.method==="GET"){
				//console.log("get");

				req_url = Querystring.parse(req.url.slice(6, req.url.length));
				handler(req_url);
		}else if(req.method==="POST"){
				//console.log("post!");
				var body = '';
				req.on('data', function (data) {
				body += data;
				if (body.length > 1e6) {
						log.error("FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST");
					// FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
				   req.connection.destroy();
				}
				});
				req.on('end', function() {
				//console.log("ENDDDDDDDDDDd");
						req_url = Querystring.parse(body);
						//console.log("END! "+JSON.stringify(req_url));
						handler(req_url);
				});
		}

}).listen(8005);

var handler=function(req_url){
		//console.log("reuest="+JSON.stringify(req_url));
		var request=JSON.parse(req_url.payload);
		console.log("r="+JSON.stringify(request));
		var backup=function(backup_needed,callback){
				console.log("backiing up = "+backup_needed);
				if(backup_needed!=false){
						var script_name="mongo_backup";
						if(backup_needed==="active"){
								script_name="mongo_backup_active";
						}else if(backup_needed==="full"){
								script_name="mongo_backup";
						}
						exec('bash /root/cron_scripts/'+script_name+'.sh', {
								cwd : "/home/www/unfaced-web/web"
						},function (error, stdout, stderr) {
								console.log("error = "+error+"   stdout="+stdout+"     stderr="+stderr);
								callback();
						});
				}else{
						callback();
				}
		}
		if(request.repository.name==="unfaced"){
				console.log("unface server repo");
				if(request.pusher.name==="jdponomarev"){
						console.log("good pusher");
						console.log("ref="+request.ref);
						var need_to_pull=false;
						var need_to_backup=false;
						var branch="jd";

						if(request.head_commit.message.indexOf("fullbackup")!==-1){
								need_to_backup="full";
						}else if(request.head_commit.message.indexOf("backup")!==-1){
								need_to_backup="active";
						}
						if(request.ref=="refs/heads/jd"){
								console.log("ref OK!!111");
								branch="jd";
								if(request.head_commit.message.indexOf("urgent")!==-1){
										console.log("urgent");
										need_to_pull=true;
								}else{
										console.log("not urgent");
								}
						}else if(request.ref=="refs/heads/master"){
								branch="master";
								console.log("push to master, updating");
						}
						if(need_to_pull===true){
								console.log("need to pull = true! branch="+branch);
								backup(need_to_backup,function(){
										exec('git checkout '+branch, {
												cwd : "/www/unfaced/"
										},function (error, stdout, stderr) {

												exec('git pull origin '+branch, {
														cwd : "/www/unfaced/"
												},function (error, stdout, stderr) {
														console.log('stdout: ' + stdout);
														console.log('stderr: ' + stderr);
												});

										});
								});
						}
				}else{
						console.log("wrong pusher="+request.repository.name);
						//TODO send sms.
				}
		}else if(request.repository.name==="unfaced-web"){
				console.log("web update!");
				if(request.pusher.name==="jdponomarev"){
						if(request.ref=="refs/heads/master"){
								if(request.head_commit.message.indexOf("urgent")!==-1){
										exec('git reset --hard HEAD', {
												cwd : "/home/www/unfaced-web/web"
										},function (error, stdout, stderr) {
												console.log('stdout: ' + stdout);
												console.log('stderr: ' + stderr);
												exec('git pull origin ', {
														cwd : "/home/www/unfaced-web/web"
												},function (error, stdout, stderr) {
														console.log('stdout: ' + stdout);
														console.log('stderr: ' + stderr);
														exec("node build/",{
																cwd:"/home/www/unfaced-web/web"
														},function(error,stdout,stderr){
																console.log('stdout: ' + stdout);
																console.log('stderr: ' + stderr);
														});

												});
										});

								}else{
										console.log("not urgent...");
								}
						}
				}
		}else{
				console.log("wrong repository "+request.repository.name);
		}

};
*/