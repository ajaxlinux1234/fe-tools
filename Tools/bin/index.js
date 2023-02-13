#!/usr/bin/env node

'use strict';
const program = require('commander');
const { initCache } = require('../util/util');

initCache()

require('../lib/rule-check')(program);
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
require('../lib/translate')(program);
require('../lib/translate-init')(program);
program.parse(process.argv);