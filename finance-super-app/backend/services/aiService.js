const axios = require('axios');

async function scoreCredit(payload) {
  try {
    const url = process.env.ML_CREDIT_SCORE_URL || 'http://localhost:8000/credit/score';
    const res = await axios.post(url, payload, { timeout: 5000 });
    if (res.data && typeof res.data.trustScore === 'number') return res.data.trustScore;
  } catch (_) {
    // ignore
  }
  return 600; // fallback score
}

async function predictDefault(payload) {
  try {
    const url = process.env.ML_DEFAULT_PREDICT_URL || 'http://localhost:8000/default/predict';
    const res = await axios.post(url, payload, { timeout: 5000 });
    if (res.data && typeof res.data.default_chance === 'number') return res.data;
  } catch (_) {
    // ignore
  }
  return { default_chance: 0.15 };
}

module.exports = { scoreCredit, predictDefault };
