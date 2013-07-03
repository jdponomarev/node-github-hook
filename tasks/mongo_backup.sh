#!/bin/sh
DATE=`/bin/date "+%Y%m%d%H"`
dest_dir="/home/backups"
/bin/mkdir -p $dest_dir/mongobackup
mongodump -o $dest_dir/mongobackup
cd $dest_dir && tar czvf mongobackup.tgz mongobackup