-- AlterTable: add columns first (initiated_by nullable so existing rows don't
-- violate NOT NULL), backfill, then tighten the constraint.
ALTER TABLE `settlements` ADD COLUMN `confirmed_at` DATETIME(3) NULL,
    ADD COLUMN `initiated_by` INTEGER NULL,
    ADD COLUMN `status` ENUM('PENDING', 'CONFIRMED') NOT NULL DEFAULT 'PENDING';

-- Backfill: settlements recorded before this feature existed were already
-- treated as final, so mark them CONFIRMED (confirmed at the time they were
-- recorded) and default the initiator to the payer, the best guess available
-- since who actually clicked "mark as paid" wasn't tracked before now.
UPDATE `settlements` SET `status` = 'CONFIRMED', `confirmed_at` = `settled_at`, `initiated_by` = `from_user_id`;

ALTER TABLE `settlements` MODIFY `initiated_by` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_initiated_by_fkey` FOREIGN KEY (`initiated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
