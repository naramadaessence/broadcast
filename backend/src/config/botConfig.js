export const MATCH_THRESHOLD = 0.45;

export const BOT_FLAGS = [
  'retrieval_v2',
  'embeddings_v2',
  'disambiguation',
  'smart_flows',
  'learning',
];

export function flagEnabled(botSettings, flag) {
  if (!botSettings || typeof botSettings !== 'object') return false;
  const flags = botSettings.flags && typeof botSettings.flags === 'object' ? botSettings.flags : {};
  return flags[flag] === true;
}

export function matchThreshold(botSettings) {
  const t = botSettings && Number(botSettings.match_threshold);
  return Number.isFinite(t) && t > 0 && t < 1 ? t : MATCH_THRESHOLD;
}

export const DEFAULT_BAND_GAP = 0.15;

function clampScore(v) {
  if (!Number.isFinite(v)) return null;
  if (v <= 0 || v >= 1) return null;
  return v;
}

export function confidenceBands(botSettings, modelDefaults = null) {
  const raw = botSettings && typeof botSettings.bands === 'object' && botSettings.bands ? botSettings.bands : {};
  const explicitThreshold = clampScore(Number(botSettings && botSettings.match_threshold));

  const baseMedium = (modelDefaults && clampScore(Number(modelDefaults.medium))) || MATCH_THRESHOLD;
  const baseHigh = (modelDefaults && clampScore(Number(modelDefaults.high))) || Math.min(0.95, baseMedium + DEFAULT_BAND_GAP);

  const medium = clampScore(Number(raw.medium)) ?? explicitThreshold ?? baseMedium;
  let high = clampScore(Number(raw.high)) ?? (explicitThreshold !== null ? Math.min(0.95, explicitThreshold + DEFAULT_BAND_GAP) : baseHigh);
  if (high <= medium) high = Math.min(0.99, medium + 0.05);

  return { high, medium };
}

export function classifyBand(score, bands, hasLexicalHit = false) {
  if (score >= bands.high) return 'high';
  if (score >= bands.medium) return 'medium';
  if (hasLexicalHit) return 'medium';
  return 'low';
}
