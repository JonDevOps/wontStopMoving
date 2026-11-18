/** Public brand contact facts. Never put customer, employee or forwarding numbers here. */
export const BUSINESS_CONTACT = {
  brand: 'WontStopMoving',
  legalBusiness: 'A Moving Service Inc.',
  phone: '+18887416683',
  phoneDisplay: '1-888-741-MOVE',
  phoneNumeric: '1-888-741-6683',
  phoneHref: 'tel:+18887416683',
  email: 'support@wontstopmoving.com',
  website: 'https://wontstopmoving.com',
} as const;

export const BUSINESS_EMAIL_SIGNATURE = `WontStopMoving\n${BUSINESS_CONTACT.phoneDisplay} (${BUSINESS_CONTACT.phoneNumeric})\n${BUSINESS_CONTACT.email}\n${BUSINESS_CONTACT.website}`;
