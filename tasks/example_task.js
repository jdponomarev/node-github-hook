var myModule=function(task,commit_data,job,callback){
	console.log("task=");
	console.dir(task);
	console.log("commit_data=");
	console.dir(commit_data);
	console.log("job=");
	console.dir(job);




	console.log("I've done all I can. exiting.");
	callback();
};
module.exports = exports = myModule;