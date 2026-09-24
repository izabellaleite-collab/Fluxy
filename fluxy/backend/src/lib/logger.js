function log(message, details) {
  console.log(`[Fluxy] ${message}${details ? ' ' + details : ''}`);
}

module.exports = { log };
