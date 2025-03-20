class Logger {
  static error(message, error) {
    console.error(`${message}:`, error);
  }
}

module.exports = Logger;
