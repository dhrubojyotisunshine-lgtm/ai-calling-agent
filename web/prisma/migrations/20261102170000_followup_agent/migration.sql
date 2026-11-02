-- AlterTable
ALTER TABLE `FollowUp` ADD COLUMN `agentId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
