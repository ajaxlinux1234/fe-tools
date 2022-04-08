#!/usr/bin/env node

'use strict';
const program = require('commander');

require('../lib/check-ctx')(program);
require('../lib/cp')(program);
require('../lib/debug')(program);
require('../lib/feishu')(program);
require('../lib/git-commit-info')(program);
require('../lib/increase')(program);
require('../lib/init')(program);
require('../lib/pipe')(program);
require('../lib/pr')(program);
require('../lib/setRAM')(program);
require('../lib/update')(program);
require('../lib/version')(program);
program.parse(process.argv);