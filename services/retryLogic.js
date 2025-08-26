export const withRetry = async (operation, retries = 3, backoff = 300) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) {
        throw new Error(`Operation failed after ${retries} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }
};