-- AlterTable
ALTER TABLE `audit_logs` ADD COLUMN `ip` VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN `userAgent` VARCHAR(500) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `admin_sessions` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_sessions_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_security_events` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NULL,
    `email` VARCHAR(191) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `ip` VARCHAR(100) NOT NULL,
    `userAgent` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_security_events_email_createdAt_idx`(`email`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_permissions` (
    `id` VARCHAR(80) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_role_permissions` (
    `roleId` VARCHAR(30) NOT NULL,
    `permissionId` VARCHAR(80) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_entries` (
    `id` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `body` TEXT NOT NULL,
    `imageUrl` VARCHAR(1000) NOT NULL DEFAULT '',
    `mobileImageUrl` VARCHAR(1000) NOT NULL DEFAULT '',
    `ctaText` VARCHAR(100) NOT NULL DEFAULT '',
    `ctaLink` VARCHAR(500) NOT NULL DEFAULT '',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `reviewedBy` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `content_entries_slug_key`(`slug`),
    INDEX `content_entries_kind_active_priority_idx`(`kind`, `active`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_security_events` ADD CONSTRAINT `admin_security_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `admin_permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
