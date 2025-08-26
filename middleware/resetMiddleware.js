const asyncMiddleware = (fn) => (req, res, next) => {
  console.log(`Request to ${req.originalUrl}`);
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error('Async middleware error:', err);
    next(err);
  });
};

export default asyncMiddleware;