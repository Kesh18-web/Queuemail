-- Create database if not exists
CREATE DATABASE IF NOT EXISTS reachinbox_email;

-- Users table
CREATE TABLE IF NOT EXISTS `User` (
  id VARCHAR(36) PRIMARY KEY,
  googleId VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_googleId (googleId),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MailCampaign table
CREATE TABLE IF NOT EXISTS MailCampaign (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  startTime DATETIME NOT NULL,
  delayBetweenMs INT DEFAULT 2000,
  hourlyLimit INT DEFAULT 50,
  status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED') DEFAULT 'SCHEDULED',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_startTime (startTime),
  FOREIGN KEY (userId) REFERENCES `User`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MailDispatch table
CREATE TABLE IF NOT EXISTS MailDispatch (
  id VARCHAR(36) PRIMARY KEY,
  campaignId VARCHAR(36) NOT NULL,
  recipientEmail VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  scheduledTime DATETIME NOT NULL,
  sentTime DATETIME NULL,
  status ENUM('PENDING', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'RATE_LIMITED') DEFAULT 'PENDING',
  errorMessage TEXT,
  senderEmail VARCHAR(255),
  previewUrl TEXT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_campaignId (campaignId),
  INDEX idx_status (status),
  INDEX idx_scheduledTime (scheduledTime),
  UNIQUE KEY unique_campaign_recipient (campaignId, recipientEmail),
  FOREIGN KEY (campaignId) REFERENCES MailCampaign(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SenderAccount table
CREATE TABLE IF NOT EXISTS SenderAccount (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  smtpHost VARCHAR(255) NOT NULL,
  smtpPort INT NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_isActive (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add previewUrl column to existing MailDispatch tables (safe to run multiple times)
ALTER TABLE MailDispatch ADD COLUMN previewUrl TEXT NULL AFTER errorMessage;

