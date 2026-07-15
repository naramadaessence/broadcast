import { query } from '../database.js';

/**
 * Check if tenant can add more users
 * For single client platform: unlimited users allowed.
 */
export const checkUserLimit = async (req, res, next) => {
  next();
};

/**
 * Check if WhatsApp feature is enabled for this tenant
 * All clients get WhatsApp enabled (must configure Meta API credentials)
 */
export const checkWhatsAppEnabled = (req, res, next) => {
  const tenant = req.tenant;

  if (!tenant) {
    return res.status(400).json({ error: 'Tenant context required' });
  }

  // Check if tenant has configured their Meta API credentials
  if (!tenant.whatsapp_configured) {
    return res.status(403).json({
      error: 'WhatsApp not configured. Add your Meta Business API credentials in Settings.',
      whatsapp_not_configured: true,
    });
  }

  next();
};
