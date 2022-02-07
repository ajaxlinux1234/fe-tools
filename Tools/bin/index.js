#!/usr/bin/env node

'use strict';
const program = require('commander');

require('../lib/version')(program);
require('../lib/update')(program);
require('../lib/pr')(program);
require('../lib/feishu')(program);
require('../lib/cp')(program);
require('../lib/git-commit-info')(program);
require('../lib/check-ctx')(program);
require('../lib/init')(program);

program.parse(process.argv);