import axios from 'axios';

const client = axios.create({
  baseURL: 'https://query1.finance.yahoo.com',
  timeout: 8000,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
  },
});

const fetchChart = ({
  symbol,
  range = '2y',
  interval = '1d',
}) => client.get(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
  params: {
    range,
    interval,
    includeAdjustedClose: true,
  },
});

export {
  fetchChart,
};
