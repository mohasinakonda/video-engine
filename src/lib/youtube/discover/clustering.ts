/**
 * Average-link agglomerative clustering on cosine similarity. Deterministic for a given
 * input: ties break on the lowest index. O(n²) memory, fine for the ≤ ~600 titles of a run.
 */
import { cosine } from './similarity';

export interface Cluster {
  /** Indexes into the input vectors. */
  members: number[];
  /** Mean cosine of members to the cluster centroid (1 = identical titles). */
  cohesion: number;
  centroid: number[];
}

/** Merges the most similar pair of clusters until no pair averages `threshold` or more. */
export function agglomerate(vectors: number[][], threshold: number): Cluster[] {
  const n = vectors.length;
  if (n === 0) return [];

  // sim[i][j]: average pairwise similarity between clusters i and j (Lance–Williams update).
  const sim: Float64Array[] = vectors.map((a, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) row[j] = i === j ? -Infinity : cosine(a, vectors[j]);
    return row;
  });
  const members: (number[] | null)[] = vectors.map((_, i) => [i]);

  for (;;) {
    let best = -Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < n; i++) {
      if (!members[i]) continue;
      const row = sim[i];
      for (let j = i + 1; j < n; j++) {
        if (members[j] && row[j] > best) {
          best = row[j];
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0 || best < threshold) break;

    const a = members[bi] as number[];
    const b = members[bj] as number[];
    for (let k = 0; k < n; k++) {
      if (!members[k] || k === bi || k === bj) continue;
      const merged = (a.length * sim[bi][k] + b.length * sim[bj][k]) / (a.length + b.length);
      sim[bi][k] = merged;
      sim[k][bi] = merged;
    }
    members[bi] = [...a, ...b];
    members[bj] = null;
  }

  return members
    .filter((m): m is number[] => m !== null)
    .map((m) => {
      const centroid = meanVector(m.map((i) => vectors[i]));
      const cohesion = m.reduce((sum, i) => sum + cosine(vectors[i], centroid), 0) / m.length;
      return { members: m.sort((x, y) => x - y), cohesion, centroid };
    });
}

export function meanVector(vectors: number[][]): number[] {
  const dim = vectors[0]?.length ?? 0;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let d = 0; d < dim; d++) out[d] += v[d];
  return out.map((x) => x / Math.max(1, vectors.length));
}
