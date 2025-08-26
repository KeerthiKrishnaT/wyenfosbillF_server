import { migrateBills } from '../utils/migrateBills.js';

migrateBills()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  });
