import { selectDiffRange } from '../../src/review-cycles/diff-range';

describe('selectDiffRange', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const last = 'c'.repeat(40);

  it('uses PR base to head for the first review', () => {
    expect(selectDiffRange(base, head, null)).toEqual({
      diffBaseSha: base,
      diffHeadSha: head,
    });
  });

  it('uses last reviewed SHA to current head after a completed review', () => {
    expect(selectDiffRange(base, head, last)).toEqual({
      diffBaseSha: last,
      diffHeadSha: head,
    });
  });
});
