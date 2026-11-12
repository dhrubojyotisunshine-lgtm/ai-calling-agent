-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `agentId` VARCHAR(191) NULL,
    ADD COLUMN `aiQueuedAt` DATETIME(3) NULL,
    ADD COLUMN `aiStatus` ENUM('NOT_QUEUED', 'QUEUED', 'INELIGIBLE') NOT NULL DEFAULT 'NOT_QUEUED',
    ADD COLUMN `aiStatusReason` VARCHAR(255) NULL,
    ADD COLUMN `budget` VARCHAR(80) NULL,
    ADD COLUMN `category` VARCHAR(80) NULL,
    ADD COLUMN `company` VARCHAR(160) NULL,
    ADD COLUMN `consentAt` DATETIME(3) NULL,
    ADD COLUMN `consentChannels` JSON NULL,
    ADD COLUMN `consentEvidence` TEXT NULL,
    ADD COLUMN `consentSource` VARCHAR(120) NULL,
    ADD COLUMN `email` VARCHAR(190) NULL,
    ADD COLUMN `language` VARCHAR(10) NULL,
    ADD COLUMN `requirements` TEXT NULL;

-- CreateTable
CREATE TABLE `Integration` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `type` ENUM('CSV_IMPORT', 'API', 'WEBHOOK', 'WEBSITE_FORM', 'ZAPIER', 'MAKE', 'GOOGLE_SHEETS', 'WORDPRESS', 'GOOGLE_ADS', 'META', 'INDIAMART', 'JUSTDIAL', 'ACRES99') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'ERROR', 'DISCONNECTED') NOT NULL DEFAULT 'ACTIVE',
    `endpointKey` VARCHAR(40) NULL,
    `config` JSON NULL,
    `lastEventAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastErrorAt` DATETIME(3) NULL,
    `lastError` VARCHAR(500) NULL,
    `totalReceived` INTEGER NOT NULL DEFAULT 0,
    `totalCreated` INTEGER NOT NULL DEFAULT 0,
    `totalMerged` INTEGER NOT NULL DEFAULT 0,
    `totalFailed` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Integration_endpointKey_key`(`endpointKey`),
    INDEX `Integration_workspaceId_type_idx`(`workspaceId`, `type`),
    UNIQUE INDEX `Integration_workspaceId_name_key`(`workspaceId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationSecret` (
    `id` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `ciphertext` TEXT NOT NULL,
    `hint` VARCHAR(12) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `IntegrationSecret_integrationId_kind_key`(`integrationId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiKey` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `prefix` VARCHAR(20) NOT NULL,
    `hash` VARCHAR(64) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApiKey_hash_key`(`hash`),
    INDEX `ApiKey_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InboundEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('RECEIVED', 'PROCESSING', 'CREATED', 'MERGED', 'REJECTED', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
    `result` VARCHAR(500) NULL,
    `trace` JSON NULL,
    `leadId` VARCHAR(191) NULL,
    `ip` VARCHAR(64) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `InboundEvent_workspaceId_receivedAt_idx`(`workspaceId`, `receivedAt`),
    INDEX `InboundEvent_integrationId_status_idx`(`integrationId`, `status`),
    UNIQUE INDEX `InboundEvent_integrationId_dedupeKey_key`(`integrationId`, `dedupeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadSourceLink` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `inboundEventId` VARCHAR(191) NULL,
    `externalLeadId` VARCHAR(191) NULL,
    `formName` VARCHAR(160) NULL,
    `campaignName` VARCHAR(160) NULL,
    `adName` VARCHAR(160) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LeadSourceLink_inboundEventId_key`(`inboundEventId`),
    INDEX `LeadSourceLink_workspaceId_leadId_idx`(`workspaceId`, `leadId`),
    INDEX `LeadSourceLink_integrationId_idx`(`integrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `actorType` VARCHAR(20) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `data` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadEvent_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `LeadEvent_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignmentRule` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `conditions` JSON NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `salespersonMode` VARCHAR(12) NOT NULL DEFAULT 'NONE',
    `salespersonIds` JSON NULL,
    `roundRobinCursor` INTEGER NOT NULL DEFAULT 0,
    `createTask` BOOLEAN NOT NULL DEFAULT true,
    `queueForAi` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssignmentRule_workspaceId_position_idx`(`workspaceId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Job` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `runAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedUntil` DATETIME(3) NULL,
    `lastError` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `Job_status_runAt_idx`(`status`, `runAt`),
    INDEX `Job_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Lead_workspaceId_email_idx` ON `Lead`(`workspaceId`, `email`);

-- CreateIndex
CREATE INDEX `Lead_workspaceId_aiStatus_idx` ON `Lead`(`workspaceId`, `aiStatus`);

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Integration` ADD CONSTRAINT `Integration_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationSecret` ADD CONSTRAINT `IntegrationSecret_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundEvent` ADD CONSTRAINT `InboundEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundEvent` ADD CONSTRAINT `InboundEvent_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundEvent` ADD CONSTRAINT `InboundEvent_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadSourceLink` ADD CONSTRAINT `LeadSourceLink_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadSourceLink` ADD CONSTRAINT `LeadSourceLink_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadEvent` ADD CONSTRAINT `LeadEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadEvent` ADD CONSTRAINT `LeadEvent_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadEvent` ADD CONSTRAINT `LeadEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentRule` ADD CONSTRAINT `AssignmentRule_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

