import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const templatePath = new URL('../infrastructure/ses/transactional-email.yaml', import.meta.url);
const cloudFormation = readFileSync(templatePath, 'utf8')
  .replaceAll('!Ref ', '')
  .replaceAll('!Sub ', '')
  .replaceAll('!GetAtt ', '')
  .replace(/!(?:Equals|Not|If) /g, '');
const template = parse(cloudFormation);
const resources = template.Resources;

const businesses = [
  ['WontStopMoving', 'wontstopmoving.com', 'wontstopmoving-transactional'],
  ['AMovingService', 'amovingservice.com', 'amovingservice-transactional'],
  ['W3Develops', 'w3develops.org', 'w3develops-transactional'],
  ['AgentGarden', 'agentgarden.org', 'agentgarden-transactional'],
];

test('only WontStopMoving resources are created by default and each business has isolated send permissions', () => {
  for (const [prefix, domain, configurationSet] of businesses) {
    const config = resources[`${prefix}ConfigurationSet`];
    assert.equal(config.Type, 'AWS::SES::ConfigurationSet');
    assert.equal(config.Properties.Name, configurationSet);
    if (prefix === 'WontStopMoving') {
      assert.equal(config.Condition, undefined);
      assert.equal(template.Parameters.EnableWontStopMovingReputationMetrics.Default, 'false');
      assert.deepEqual(config.Properties.ReputationOptions.ReputationMetricsEnabled, ['ShouldExportWontStopMovingReputationMetrics', true, false]);
    } else {
      assert.equal(template.Parameters[`${prefix}GoogleSubject`].Default, '');
      for (const name of ['ConfigurationSet', 'EmailRole', 'Events', 'TopicPolicy', 'EventDestination']) {
        assert.equal(resources[`${prefix}${name}`].Condition, `ShouldCreate${prefix}`);
      }
      assert.equal(config.Properties.ReputationOptions.ReputationMetricsEnabled, false);
    }
    assert.equal(config.Properties.SuppressionOptions, undefined); // Preserve the account-level suppression policy.
    assert.equal(config.Properties.VdmOptions, undefined); // Do not turn on the optional paid VDM feature.

    const topic = resources[`${prefix}Events`];
    assert.equal(topic.Type, 'AWS::SNS::Topic');
    assert.equal(topic.Properties.SignatureVersion, '2');
    const destination = resources[`${prefix}EventDestination`].Properties.EventDestination;
    assert.equal(resources[`${prefix}EventDestination`].DependsOn, `${prefix}TopicPolicy`);
    assert.deepEqual(destination.MatchingEventTypes, ['SEND', 'REJECT', 'BOUNCE', 'COMPLAINT', 'DELIVERY', 'DELIVERY_DELAY', 'RENDERING_FAILURE']);

    const role = resources[`${prefix}EmailRole`];
    const trust = role.Properties.AssumeRolePolicyDocument.Statement[0];
    assert.equal(trust.Principal.Federated, 'accounts.google.com');
    assert.equal(trust.Action, 'sts:AssumeRoleWithWebIdentity');
    assert.deepEqual(Object.keys(trust.Condition.StringEquals).sort(), ['accounts.google.com:aud', 'accounts.google.com:oaud', 'accounts.google.com:sub']);
    assert.equal(trust.Condition.StringEquals['accounts.google.com:aud'], `${prefix}GoogleSubject`);
    assert.equal(trust.Condition.StringEquals['accounts.google.com:oaud'], `${prefix}GoogleAudience`);
    assert.equal(trust.Condition.StringEquals['accounts.google.com:sub'], `${prefix}GoogleSubject`);
    const statement = role.Properties.Policies[0].PolicyDocument.Statement[0];
    assert.equal(statement.Action, 'ses:SendEmail');
    assert.equal(statement.Condition.StringEquals['ses:FromAddress'], `noreply@${domain}`);
    const resourcesText = JSON.stringify(statement.Resource);
    assert.match(resourcesText, new RegExp(`identity/${domain.replaceAll('.', '\\.')}`));
    assert.match(resourcesText, new RegExp(`configuration-set/${configurationSet}`));
    for (const [, otherDomain] of businesses.filter(([otherPrefix]) => otherPrefix !== prefix)) {
      assert.equal(resourcesText.includes(`identity/${otherDomain}`), false, `${prefix} must not send as ${otherDomain}`);
    }
  }
});

test('the live feedback subscription is disabled until its secure route is deployed', () => {
  assert.equal(template.Parameters.CreateWontStopMovingSubscription.Default, 'false');
  assert.equal(resources.WontStopMovingFeedbackSubscription.Condition, 'ShouldCreateWontStopMovingSubscription');
  assert.equal(resources.WontStopMovingFeedbackSubscription.Properties.Endpoint, 'https://wontstopmoving.com/api/webhooks/aws/ses');
  assert.equal(resources.WontStopMovingFeedbackSubscription.Properties.Protocol, 'https');
});
