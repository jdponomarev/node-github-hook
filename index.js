var http = require('http');
var Querystring=require("querystring");
var util = require('util');
var exec = require('child_process').exec;
console.log("started!");
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
