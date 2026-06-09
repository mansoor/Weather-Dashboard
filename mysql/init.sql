-- Ensure the database exists with proper charset
CREATE DATABASE IF NOT EXISTS `weather_dashboard`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `weather_dashboard`.* TO 'weather'@'%';
FLUSH PRIVILEGES;
