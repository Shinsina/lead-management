const Joi = require('@parameter1/joi');
const { validateAsync } = require('@parameter1/joi/utils');
const { getAsArray, getAsObject } = require('@parameter1/utils');
const gql = require('graphql-tag');
const { Parser } = require('json2csv');
const dayjs = require('../../dayjs');

const METRICS_FRAGMENT = gql`
  fragment ExportLineItemMetricsFragment on EmailDeploymentMetrics {
    sent
    delivered
    deliveryRate
    uniqueOpens
    uniqueClicks
    unsubscribes
    openRate
    clickToOpenRate
    clickToDeliveredRate
    bounces
  }
`;

const QUERY = gql`
  query ExportEmailLineItemMetrics($hash: String!, $sort: EmailLineItemMetricsReportSortInput!) {
    emailLineItemMetricsReport(hash: $hash, sort: $sort) {
      deployments {
        identities
        clicks
        advertiserClickRate
        deployment {
          id
          name
          designation
          metrics {
            ...ExportLineItemMetricsFragment
          }
          sentDate
        }
      }
      totals {
        identities
        sends
        clicks
        advertiserClickRate
        metrics {
          ...ExportLineItemMetricsFragment
        }
      }
    }
  }

  ${METRICS_FRAGMENT}
`;

module.exports = async (params = {}, { context }) => {
  const { hash } = await validateAsync(Joi.object({
    hash: Joi.string().trim().pattern(/[a-f0-9]{32}/).required(),
  }).required(), params);

  const { apollo } = context;
  const variables = { hash, sort: { field: 'sentDate', order: 1 } };
  const { data } = await apollo.query({ query: QUERY, variables });

  const rows = getAsArray(data, 'emailLineItemMetricsReport.deployments').map((row) => {
    const { deployment } = row;
    const { metrics } = deployment;
    return {
      Name: deployment.name,
      Date: dayjs.tz(deployment.sentDate, 'America/Chicago').format('MMM Do, YYYY HH:mm a'),
      Delivered: metrics.delivered,
      'Unique Opens': metrics.uniqueOpens,
      'Unique Clicks': metrics.uniqueClicks,
      'Open Rate': (metrics.openRate * 100).toFixed(1),
      CTOR: (metrics.clickToOpenRate * 100).toFixed(1),
      CTR: (metrics.clickToDeliveredRate * 100).toFixed(1),
      'Advertiser CTR': (row.advertiserClickRate * 100).toFixed(1),
      'Total Ad Clicks per Day': row.clicks,
      'Total Unique Clicks': row.identities,
      // 'Preview URL': send.url,
    };
  });

  const totals = getAsObject(data, 'emailLineItemMetricsReport.totals');
  const { metrics } = totals;
  rows.push({
    Name: `Total Emails: ${totals.sends}`,
    Date: '',
    Delivered: metrics.delivered,
    'Unique Opens': metrics.uniqueOpens,
    'Unique Clicks': metrics.uniqueClicks,
    'Open Rate': (metrics.openRate * 100).toFixed(1),
    CTOR: (metrics.clickToOpenRate * 100).toFixed(1),
    CTR: (metrics.clickToDeliveredRate * 100).toFixed(1),
    'Advertiser CTR': (totals.advertiserClickRate * 100).toFixed(1),
    'Total Ad Clicks per Day': totals.clicks,
    'Total Unique Clicks': totals.identities,
    // 'Preview URL': '',
  });

  if (!rows.length) return '';
  const parser = new Parser({
    fields: Object.keys(rows[0]),
  });
  return parser.parse(rows);
};
