#!/usr/bin/env node

'use strict';

const program = require('commander');

require('../lib/update')(program);
require('../lib/pr')(program);

program.parse(process.argv);
