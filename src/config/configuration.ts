import * as dotenv from 'dotenv';

dotenv.config();

export default () => ({
    PORT: process.env.PORT,
    JWT: {
        SECRET: process.env.JWT_ACCESS_SECRET,
        EXPIRES_IN: process.env.ACCESS_EXPIRES_IN,
    },
    
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
    REFRESH_EXPIRES_IN: process.env.REFRESH_EXPIRES_IN || '',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || '',
    ACCESS_EXPIRES_IN: process.env.ACCESS_EXPIRES_IN || '',
    TERMII_BASE_URL: process.env.TERMII_BASE_URL || '',
    TERMII_API_KEY: process.env.TERMII_API_KEY || '',
    TERMII_SENDER_ID: process.env.TERMII_SENDER_ID || '',
    PAYDESTAL_BASE_URL: process.env.PAYDESTAL_BASE_URL || '',
    WEBHOOK_REPUSH: process.env.WEBHOOK_REPUSH || '',
    CREATE_DEDICATED_ACCOUNT: process.env.CREATE_DEDICATED_ACCOUNT || '',
    PAYDESTAL_SECRET_KEY: process.env.PAYDESTAL_SECRET_KEY || '',
    PAYDESTAL_PUBLIC_KEY: process.env.PAYDESTAL_PUBLIC_KEY || '',
});
