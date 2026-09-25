export function selectDiffRange(
  baseSha: string,
  headSha: string,
  lastReviewedSha: string | null,
): { diffBaseSha: string; diffHeadSha: string } {
  if (!lastReviewedSha) {
    return { diffBaseSha: baseSha, diffHeadSha: headSha };
  }
  return { diffBaseSha: lastReviewedSha, diffHeadSha: headSha };
}
