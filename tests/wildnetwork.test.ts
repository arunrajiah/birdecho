import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSolidArrival } from '../src/lib/wildnetwork';

// Values as returned by WildNetwork /api/v1/arrivals for the Boston cell (40,-75), 2026-10-07.
describe('WildNetwork arrivals filter', () => {
  it('drops weak seasons and keeps solid or unscored ones', () => {
    assert.equal(isSolidArrival({ arrivalSupport: 0.28 }), false); // Eurasian Curlew
    assert.equal(isSolidArrival({ arrivalSupport: 0.78 }), true); // Long-eared Owl
    assert.equal(isSolidArrival({ arrivalSupport: 1 }), true); // White-crowned Sparrow
    assert.equal(isSolidArrival({ arrivalSupport: 0.5 }), true);
    assert.equal(isSolidArrival({ arrivalSupport: null }), true);
    assert.equal(isSolidArrival({}), true);
  });
});
