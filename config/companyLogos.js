// Company logos configuration - direct Firebase Storage URLs
export const companyLogos = {
  'WYENFOS': 'https://storage.googleapis.com/wyenfosbills.appspot.com/wyenfos.png',
  'WYENFOS GOLD & DIAMONDS': 'https://storage.googleapis.com/wyenfosbills.appspot.com/wyenfos_gold.png',
  'WYENFOS INFOTECH': 'https://storage.googleapis.com/wyenfosbills.appspot.com/wyenfos_infotech.png',
  'WYENFOS PURE DROPS': 'https://storage.googleapis.com/wyenfosbills.appspot.com/wyenfos%20pure%20drops.png',
  'AYUR FOR HERBALS INDIA': 'https://storage.googleapis.com/wyenfosbills.appspot.com/Ayur4life_logo.png',
  'WYENFOS ADS': 'https://storage.googleapis.com/wyenfosbills.appspot.com/wyenfos_ads.png',
  'WYENFOS CASH VAPASE': 'https://storage.googleapis.com/wyenfosbills.appspot.com/wyenfos_cash.png',
  'WYENFOS BILLS': 'https://storage.googleapis.com/wyenfosbills.appspot.com/Wyenfos_bills_logo.png'
};

// Get logo URL by company name
export const getCompanyLogoUrl = (companyName) => {
  return companyLogos[companyName] || companyLogos['WYENFOS']; // Default to WYENFOS if not found
};

// Get all available company names
export const getAvailableCompanies = () => {
  return Object.keys(companyLogos);
};
