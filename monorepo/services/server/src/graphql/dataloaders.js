const DataLoader = require('dataloader');

const {
  Campaign,
  Customer,
  ExcludedEmailDomain,
  ExtractedHost,
  ExtractedUrl,
  Identity,
  OmedaDemographic,
  OmedaDeploymentType,
  OmedaEmailDeployment,
  Order,
  Tag,
  User,
} = require('../mongodb/models');
const LineItem = require('../mongodb/models/line-item');

// const Form = require('../models/form');
// const FormEntry = require('../models/form-entry');

const createBatchFn = (Model) => async (ids) => {
  const docs = await Model.find({ _id: { $in: ids } });
  const map = docs.reduce((m, doc) => {
    m.set(`${doc._id}`, doc);
    return m;
  }, new Map());
  return ids.map((id) => map.get(`${id}`));
};

const createEntityBatchFn = (Model) => async (entities) => {
  const docs = await Model.find({ entity: { $in: entities } });
  const map = docs.reduce((m, doc) => {
    m.set(doc.entity, doc);
    return m;
  }, new Map());
  return entities.map((entity) => map.get(entity));
};

const loaders = {
  campaign: new DataLoader(createBatchFn(Campaign)),
  customer: new DataLoader(createBatchFn(Customer)),
  deploymentTypeEntity: new DataLoader(createEntityBatchFn(OmedaDeploymentType)),
  emailDeployment: new DataLoader(createBatchFn(OmedaEmailDeployment)),
  emailDeploymentEntity: new DataLoader(createEntityBatchFn(OmedaEmailDeployment)),
  extractedHost: new DataLoader(createBatchFn(ExtractedHost)),
  extractedUrl: new DataLoader(createBatchFn(ExtractedUrl)),
  // form: new DataLoader(createBatchFn(Form)),
  // formEntry: new DataLoader(createBatchFn(FormEntry)),
  identity: new DataLoader(createBatchFn(Identity)),
  identityEntity: new DataLoader(createEntityBatchFn(Identity)),
  lineItem: new DataLoader(createBatchFn(LineItem)),
  omedaDemographicEntity: new DataLoader(createEntityBatchFn(OmedaDemographic)),
  order: new DataLoader(createBatchFn(Order)),
  tag: new DataLoader(createBatchFn(Tag)),
  user: new DataLoader(createBatchFn(User)),

  excludedEmailDomains: new DataLoader(async (domains) => {
    const docs = await ExcludedEmailDomain.find({ domain: { $in: domains } });
    const map = docs.reduce((m, doc) => {
      m.set(doc.domain, doc);
      return m;
    }, new Map());
    return domains.map((domain) => map.get(domain));
  }),
};

module.exports = loaders;

/**
 * @typedef {Record<keyof loaders, DataLoader>} LeadsGraphQLDataLoaders
 */
