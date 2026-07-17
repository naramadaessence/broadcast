/**
 * Middleware: loads the singleton Settings document from MongoDB
 * and attaches it to req.tenant / req.tenantId for backward compatibility
 * with the WhatsApp service layer (which reads tenant.whatsapp_access_token, etc.)
 */
import Setting from '../models/Setting.js';

export const loadSettings = async (req, res, next) => {
    try {
        let setting = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!setting) {
            setting = await Setting.findOne();
            if (setting) {
                setting.singletonId = 'admin_settings';
                await setting.save();
            } else {
                setting = new Setting({ singletonId: 'admin_settings' });
                await setting.save();
            }
        }

        const settingObj = setting.toObject();
        settingObj.id = settingObj._id?.toString();

        req.tenant = settingObj;
        req.tenantId = settingObj.id;
        next();
    } catch (error) {
        console.error('Failed to load settings:', error);
        return res.status(500).json({ error: 'Failed to load application settings' });
    }
};
