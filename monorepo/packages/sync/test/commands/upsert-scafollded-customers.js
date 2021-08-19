const run = require('../_run');
const command = require('../../commands/upsert-scaffolded-customers');

run(command, { tenantKey: 'lynchm' })
  .catch((e) => setImmediate(() => { throw e; }));
