// Vercel Serverless Function entrypoint
require('dotenv').config();
const app = require('../lib/serverApp');

module.exports = app;
