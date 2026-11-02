-- DropForeignKey
ALTER TABLE `Campaign` DROP FOREIGN KEY `Campaign_agentId_fkey`;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
