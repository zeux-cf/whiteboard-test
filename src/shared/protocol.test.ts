import { describe, expect, it } from 'vitest';
import { elementsEqual, type BoardElement } from './model';
import { parseClientMessage } from './protocol';

const rectangle: BoardElement = {
  id: 'rectangle', type: 'rectangle', x: 0, y: -12, width: 120, height: 60, label: 'Step', color: '#315ABD',
};

describe('board protocol', () => {
  it('validates element identity and revision preconditions', () => {
    const commit = { type: 'commit', id: 'test', changes: [{ id: 'rectangle', before: null, after: rectangle }] };
    expect(parseClientMessage(commit)).toEqual(commit);
    expect(parseClientMessage({ ...commit, changes: [...commit.changes, ...commit.changes] })).toBeNull();
    expect(parseClientMessage({ ...commit, changes: [{ id: 'other', before: rectangle, after: null }] })).toBeNull();
    expect(parseClientMessage({ ...commit, changes: [{ id: 'rectangle', before: null, after: null }] })).toBeNull();
  });

  it('rejects nonfinite points and unusable shape sizes', () => {
    expect(parseClientMessage({ type: 'cursor', point: { x: Infinity, y: 0 } })).toBeNull();
    expect(parseClientMessage({
      type: 'commit', id: 'test',
      changes: [{ id: 'rectangle', before: null, after: { ...rectangle, width: 0 } }],
    })).toBeNull();
  });

  it('compares canonical element fields independently of key order', () => {
    const { color, ...rest } = rectangle;
    expect(elementsEqual(rectangle, { color, ...rest })).toBe(true);
    expect(elementsEqual(rectangle, { ...rectangle, label: 'Changed' })).toBe(false);
  });
});
