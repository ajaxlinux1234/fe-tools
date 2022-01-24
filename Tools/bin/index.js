#!/usr/bin/env node

'use strict';

const program = require('commander');

require('../lib/version')(program);
require('../lib/update')(program);
require('../lib/pr')(program);

program.parse(process.argv);
