import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { validateLineSignature } from '../middleware/index.js';
import { fetchChart } from '../services/yahoo-finance.js';
import storage from '../storage/index.js';
import { summarizeMomentum, extractCloses } from '../utils/momentum.js';
import { fetchVersion, getVersion } from '../utils/index.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

app.get('/', (req, res) => {
  if (config.APP_URL) {
    res.redirect(config.APP_URL);
    return;
  }
  res.sendStatus(200);
});

app.get('/dashboard', (req, res) => {
  const filePath = path.resolve(__dirname, '../demo/momentum-dashboard.html');
  res.sendFile(filePath);
});

app.get('/api/stocks/momentum', async (req, res) => {
  const symbolsParam = (req.query.symbols || '').toString();
  const benchmark = (req.query.benchmark || 'SPY').toString().trim().toUpperCase();
  const symbols = symbolsParam
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);

  if (symbols.length === 0) {
    res.status(400).send({ error: 'symbols is required, e.g. symbols=AAPL,MSFT,QQQ' });
    return;
  }

  try {
    const benchmarkResponse = await fetchChart({ symbol: benchmark, range: '2y' });
    const benchmarkCloses = extractCloses(benchmarkResponse);
    const benchmarkSummary = summarizeMomentum({
      symbol: benchmark,
      closes: benchmarkCloses,
      benchmarkR12m: null,
    });

    const benchmarkR12m = benchmarkSummary.momentum.r12m;
    const stockResponses = await Promise.all(symbols.map((symbol) => fetchChart({ symbol, range: '2y' })));

    const data = stockResponses
      .map((response, index) => {
        const symbol = symbols[index];
        const closes = extractCloses(response);
        return summarizeMomentum({
          symbol,
          closes,
          benchmarkR12m,
        });
      })
      .sort((a, b) => (b.momentum.relative12mVsBenchmark || -Infinity)
        - (a.momentum.relative12mVsBenchmark || -Infinity));

    res.status(200).send({
      benchmark: benchmarkSummary,
      symbols,
      generatedAt: new Date().toISOString(),
      data,
    });
  } catch (err) {
    res.status(500).send({
      error: 'Failed to fetch market data',
      details: err.message,
    });
  }
});

app.get('/info', async (req, res) => {
  const currentVersion = getVersion();
  const latestVersion = await fetchVersion();
  res.status(200).send({ currentVersion, latestVersion });
});

app.post(config.APP_WEBHOOK_PATH, validateLineSignature, async (req, res) => {
  try {
    await storage.initialize();
    await handleEvents(req.body.events);
    res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    res.sendStatus(500);
  }
  if (config.APP_DEBUG) printPrompts();
});

if (config.APP_PORT) {
  app.listen(config.APP_PORT);
}

export default app;
