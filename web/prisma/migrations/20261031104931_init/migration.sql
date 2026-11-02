-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `gstNumber` VARCHAR(20) NULL,
    `walletBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `lowBalanceAt` DECIMAL(12, 2) NOT NULL DEFAULT 200,
    `callWindowFrom` VARCHAR(5) NOT NULL DEFAULT '10:00',
    `callWindowTo` VARCHAR(5) NOT NULL DEFAULT '19:00',
    `planId` VARCHAR(191) NULL,
    `planRenewsOn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'OWNER',
    `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `monthlyPrice` DECIMAL(12, 2) NOT NULL,
    `agentLimit` INTEGER NOT NULL,
    `channels` INTEGER NOT NULL,
    `kbChars` INTEGER NOT NULL,
    `faqLimit` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Plan_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED') NOT NULL DEFAULT 'ACTIVE',
    `mode` ENUM('ASSISTANT', 'ANNOUNCEMENT') NOT NULL DEFAULT 'ASSISTANT',
    `purpose` ENUM('OUTBOUND', 'INBOUND', 'BOTH') NOT NULL DEFAULT 'OUTBOUND',
    `phoneNumberId` VARCHAR(191) NULL,
    `greeting` TEXT NULL,
    `systemPrompt` TEXT NULL,
    `fallbackResponse` TEXT NULL,
    `noResponseTimeoutSec` INTEGER NOT NULL DEFAULT 30,
    `noResponseClosing` TEXT NULL,
    `announcementScript` TEXT NULL,
    `endAfterAnnouncement` BOOLEAN NOT NULL DEFAULT true,
    `knowledgeText` MEDIUMTEXT NULL,
    `personality` VARCHAR(40) NOT NULL DEFAULT 'friendly',
    `language` VARCHAR(10) NOT NULL DEFAULT 'hi-IN',
    `voiceGender` VARCHAR(10) NOT NULL DEFAULT 'female',
    `voiceId` VARCHAR(80) NULL,
    `llmProvider` VARCHAR(40) NOT NULL DEFAULT 'anthropic',
    `llmModel` VARCHAR(80) NOT NULL DEFAULT 'claude-haiku-5-5',
    `sttProvider` VARCHAR(40) NOT NULL DEFAULT 'deepgram',
    `ttsProvider` VARCHAR(40) NOT NULL DEFAULT 'sarvam',
    `memoryEnabled` BOOLEAN NOT NULL DEFAULT true,
    `recordingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `maxConcurrentCalls` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Agent_workspaceId_idx`(`workspaceId`),
    UNIQUE INDEX `Agent_workspaceId_name_key`(`workspaceId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentFaq` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `AgentFaq_agentId_idx`(`agentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogItem` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `type` ENUM('SERVICE', 'PRODUCT') NOT NULL DEFAULT 'SERVICE',
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `priceText` VARCHAR(120) NULL,
    `mayQuotePrice` BOOLEAN NOT NULL DEFAULT true,
    `whenToOffer` VARCHAR(255) NULL,
    `nextAction` VARCHAR(255) NULL,
    `trialDays` INTEGER NULL,
    `signupUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CatalogItem_workspaceId_idx`(`workspaceId`),
    UNIQUE INDEX `CatalogItem_workspaceId_name_key`(`workspaceId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentCatalogItem` (
    `agentId` VARCHAR(191) NOT NULL,
    `catalogItemId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`agentId`, `catalogItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhoneNumber` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `e164` VARCHAR(20) NOT NULL,
    `channels` INTEGER NOT NULL DEFAULT 1,
    `sipTrunkId` VARCHAR(120) NULL,
    `monthlyRent` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `renewsOn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PhoneNumber_e164_key`(`e164`),
    INDEX `PhoneNumber_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `city` VARCHAR(80) NULL,
    `fields` JSON NULL,
    `stage` ENUM('NEW', 'CONTACTED', 'INTERESTED', 'DEMO_PROPOSAL', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `interestedItemId` VARCHAR(191) NULL,
    `dealValue` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `memory` TEXT NULL,
    `assignedUserId` VARCHAR(191) NULL,
    `isDnd` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_workspaceId_stage_idx`(`workspaceId`, `stage`),
    UNIQUE INDEX `Lead_workspaceId_phone_key`(`workspaceId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `startAt` DATETIME(3) NULL,
    `callWindowFrom` VARCHAR(5) NOT NULL DEFAULT '10:00',
    `callWindowTo` VARCHAR(5) NOT NULL DEFAULT '19:00',
    `maxConcurrent` INTEGER NOT NULL DEFAULT 1,
    `retryCount` INTEGER NOT NULL DEFAULT 2,
    `retryGapMinutes` INTEGER NOT NULL DEFAULT 180,
    `skipDnd` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `Campaign_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignLead` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CALLING', 'ANSWERED', 'NO_ANSWER', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NULL,
    `lastError` VARCHAR(255) NULL,

    INDEX `CampaignLead_campaignId_status_nextAttemptAt_idx`(`campaignId`, `status`, `nextAttemptAt`),
    UNIQUE INDEX `CampaignLead_campaignId_leadId_key`(`campaignId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Call` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `direction` ENUM('OUTBOUND', 'INBOUND', 'BROWSER_TEST') NOT NULL,
    `status` ENUM('QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `fromNumber` VARCHAR(20) NULL,
    `toNumber` VARCHAR(20) NULL,
    `roomName` VARCHAR(120) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `answeredAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `durationSec` INTEGER NOT NULL DEFAULT 0,
    `ratePerMin` DECIMAL(8, 2) NULL,
    `totalCharge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `recordingUrl` VARCHAR(500) NULL,
    `summary` TEXT NULL,
    `outcome` ENUM('INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'MESSAGE_PLAYED', 'NO_DECISION') NULL,
    `failReason` VARCHAR(255) NULL,
    `usage` JSON NULL,

    INDEX `Call_workspaceId_startedAt_idx`(`workspaceId`, `startedAt`),
    INDEX `Call_campaignId_idx`(`campaignId`),
    INDEX `Call_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallMessage` (
    `id` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `role` ENUM('AGENT', 'CUSTOMER') NOT NULL,
    `text` TEXT NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CallMessage_callId_at_idx`(`callId`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowUp` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NULL,
    `kind` ENUM('AI_CALLBACK', 'STAFF_TASK') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `status` ENUM('OPEN', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `assignedUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `doneAt` DATETIME(3) NULL,

    INDEX `FollowUp_workspaceId_status_dueAt_idx`(`workspaceId`, `status`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WalletTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `type` ENUM('TOPUP', 'CALL_CHARGE', 'PLAN', 'ADJUSTMENT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `balanceAfter` DECIMAL(12, 2) NOT NULL,
    `callId` VARCHAR(191) NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WalletTransaction_callId_key`(`callId`),
    INDEX `WalletTransaction_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agent` ADD CONSTRAINT `Agent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agent` ADD CONSTRAINT `Agent_phoneNumberId_fkey` FOREIGN KEY (`phoneNumberId`) REFERENCES `PhoneNumber`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentFaq` ADD CONSTRAINT `AgentFaq_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogItem` ADD CONSTRAINT `CatalogItem_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentCatalogItem` ADD CONSTRAINT `AgentCatalogItem_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentCatalogItem` ADD CONSTRAINT `AgentCatalogItem_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhoneNumber` ADD CONSTRAINT `PhoneNumber_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_interestedItemId_fkey` FOREIGN KEY (`interestedItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignLead` ADD CONSTRAINT `CampaignLead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignLead` ADD CONSTRAINT `CampaignLead_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallMessage` ADD CONSTRAINT `CallMessage_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
