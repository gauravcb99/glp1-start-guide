// Student t quantiles for the Welch–Satterthwaite interval. Non-integer degrees of freedom allowed.

/** ln Γ(x) for x > 0 (Lanczos approximation, relative error < 2e-10). */
function lnGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let series = 1.000000000190015;
  for (const ci of c) series += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

/** Continued fraction for the regularized incomplete beta function (modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d;
    c = 1 + aa / c;
    d = 1 / (Math.abs(d) < tiny ? tiny : d);
    c = Math.abs(c) < tiny ? tiny : c;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d;
    c = 1 + aa / c;
    d = 1 / (Math.abs(d) < tiny ? tiny : d);
    c = Math.abs(c) < tiny ? tiny : c;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** CDF of Student's t with `df` degrees of freedom. */
export function studentTCdf(t: number, df: number): number {
  const tail = 0.5 * incompleteBeta(df / 2, 0.5, df / (df + t * t));
  return t > 0 ? 1 - tail : tail;
}

/** Quantile of Student's t (p in (0, 1)), by bisection on the CDF. */
export function studentTQuantile(p: number, df: number): number {
  if (!(p > 0 && p < 1) || !(df > 0)) throw new Error("studentTQuantile: p must be in (0, 1) and df > 0");
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Welch–Satterthwaite degrees of freedom for a sum of independent variance components. */
export function welchSatterthwaiteDf(components: { variance: number; df: number }[]): number {
  const used = components.filter((c) => c.variance > 0 && c.df > 0);
  if (used.length === 0) return Math.max(1, ...components.map((c) => c.df));
  const total = used.reduce((s, c) => s + c.variance, 0);
  const denom = used.reduce((s, c) => s + (c.variance * c.variance) / c.df, 0);
  return (total * total) / denom;
}
