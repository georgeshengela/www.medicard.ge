import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isLocalDatabaseUrl } from '../../scripts/no-db-push.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('schema safety', () => {
  it('no npm script or deploy step runs a raw `prisma db push`', () => {
    for (const rel of ['../../package.json', '../../../package.json']) {
      const { scripts } = JSON.parse(read(rel));
      for (const [name, cmd] of Object.entries(scripts)) {
        assert.equal(/prisma\s+db\s+push/.test(cmd), false, `${rel} script "${name}" runs prisma db push`);
      }
    }
    assert.equal(/db\s+push/.test(read('../../../render.yaml')), false);
  });

  it('db push guard allows only local databases', () => {
    assert.equal(isLocalDatabaseUrl('postgresql://u:p@localhost:5432/x'), true);
    assert.equal(isLocalDatabaseUrl('postgresql://u:p@127.0.0.1:55432/x'), true);
    assert.equal(isLocalDatabaseUrl('postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb'), false);
    assert.equal(isLocalDatabaseUrl(''), false);
  });

  it('raw-SQL tables are declared in the Prisma schema so nothing drops them', () => {
    const schema = read('../../prisma/schema.prisma');
    for (const model of ['CommunityConfig', 'PriceDropAlert', 'CatalogPriceHistory', 'Referral', 'ReferralCode', 'FeatureFlag', 'UserLocation', 'EmailTemplate', 'EmailLog', 'EmailSuppression', 'EmailCampaign', 'SupportThread', 'SupportMessage', 'SupportSnippet', 'Gym', 'TrainerProfile', 'TrainerLink', 'TrainerSession', 'TrainerMealPlan', 'ProgressPhoto', 'WorkoutLog']) {
      assert.match(schema, new RegExp(`^model ${model} \{`, 'm'), `${model} missing from schema.prisma`);
    }
  });
});
