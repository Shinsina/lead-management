const Joi = require('@parameter1/joi');
const { validateAsync } = require('@parameter1/joi/utils');
const { getAsArray, getAsObject, get } = require('@parameter1/utils');
const gql = require('graphql-tag');
const { Parser } = require('json2csv');
const dayjs = require('../../dayjs');

const METRICS_FRAGMENT = gql`
  fragment ExportMetricsFragment on EmailDeploymentMetrics {
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
  query ExportCampaignEmailMetrics($hash: String!, $sort: ReportEmailMetricsSortInput!) {
    reportEmailMetrics(hash: $hash, sort: $sort) {
      campaign {
        id
        showAdvertiserCTOR
        showTotalAdClicksPerDay
        showTotalUniqueClicks
      }
      deployments {
        identities
        clicks
        advertiserClickRate
        deployment {
          id
          name
          designation
          metrics {
            ...ExportMetricsFragment
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
          ...ExportMetricsFragment
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
  const showAdvertiserCTOR = get(data, 'reportEmailMetrics.campaign.showAdvertiserCTOR');
  const showTotalAdClicksPerDay = get(data, 'reportEmailMetrics.campaign.showTotalAdClicksPerDay');
  const showTotalUniqueClicks = get(data, 'reportEmailMetrics.campaign.showTotalUniqueClicks');
  let campaignHasEblast = false;

  const rows = getAsArray(data, 'reportEmailMetrics.deployments').map((row) => {
    const { deployment } = row;
    const { metrics } = deployment;
    const isEblast = deployment.name.match(/eblast/i);
    if (isEblast) campaignHasEblast = true;
    return {
      Name: deployment.name,
      Date: dayjs.tz(deployment.sentDate, 'America/Chicago').format('MMM Do, YYYY HH:mm a'),
      Delivered: metrics.delivered,
      'Unique Opens': metrics.uniqueOpens,
      ...(!isEblast && { 'Unique Clicks': metrics.uniqueClicks }),
      'Open Rate': (metrics.openRate * 100).toFixed(1),
      CTOR: (metrics.clickToOpenRate * 100).toFixed(1),
      CTR: (metrics.clickToDeliveredRate * 100).toFixed(1),
      ...(showAdvertiserCTOR && { 'Advertiser CTR': (row.advertiserClickRate * 100).toFixed(1) }),
      ...(showTotalAdClicksPerDay && { 'Total Ad Clicks per Day': row.clicks }),
      ...(showTotalUniqueClicks && { 'Total Unique Clicks': row.identities }),
      // 'Preview URL': send.url,
    };
  });

  const totals = getAsObject(data, 'reportEmailMetrics.totals');
  const { metrics } = totals;
  rows.push({
    Name: `Total Emails: ${totals.sends}`,
    Date: '',
    Delivered: metrics.delivered,
    'Unique Opens': metrics.uniqueOpens,
    ...(!campaignHasEblast && { 'Unique Clicks': metrics.uniqueClicks }),
    'Open Rate': (metrics.openRate * 100).toFixed(1),
    CTOR: (metrics.clickToOpenRate * 100).toFixed(1),
    CTR: (metrics.clickToDeliveredRate * 100).toFixed(1),
    ...(showAdvertiserCTOR && { 'Advertiser CTR': (totals.advertiserClickRate * 100).toFixed(1) }),
    ...(showTotalAdClicksPerDay && { 'Total Ad Clicks per Day': totals.clicks }),
    'Total Unique Clicks': totals.identities,
    // 'Preview URL': '',
  });

  if (!rows.length) return '';
  const rowsComplete = rows.filter((row) => row['Unique Clicks']);
  const parser = new Parser({
    fields: Object.keys(rowsComplete.length ? rowsComplete[0] : rows[0]),
  });
  return parser.parse(rows);
};
