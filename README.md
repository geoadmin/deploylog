deploylog
=========

1. `git clone https://github.com/geoadmin/deploylog`
1. `cd deploylog`
1. `npm install`
1. `node index.js`

Then the following happens:

1. Updates local nosql db with latest deploy entries using elasticsearch **THIS IS
   CURRENTLY NOT WORKING** (our logging infra is not really stable...)
2. Displays deploy logs in a reasonably readable format

As elasticsearch is currently down, to test it, use my existing nosql db by
copying the `/home/ltjeg/deploylog/.data` folder into your `deploylog` folder.
Then run `node index.js` to see sample output.

Note: currently, deploys that use db_cluster_all as targets are excluded from
the output as they signify automated deploys most of the time. This can easily
be activated in code.

Additions (PR) and questions (issues) welcome.
