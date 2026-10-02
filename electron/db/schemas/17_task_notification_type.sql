-- 任务模块通知类型注册：通知中心代码零改动，注册后存储/展示/筛选/系统通知自动支持
-- 幂等：重复执行无副作用（种子仅在该类型不存在时写入）。
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_assigned', '任务分配', 'task', 1, 1, 30
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_assigned');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_due_soon', '任务即将到期', 'task', 1, 1, 31
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_due_soon');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_overdue', '任务已逾期', 'task', 1, 1, 32
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_overdue');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_progress', '任务进展提交', 'task', 1, 1, 33
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_progress');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_status', '任务状态变更', 'task', 1, 1, 34
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_status');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_approved', '任务验收通过', 'task', 1, 1, 35
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_approved');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_rejected', '任务验收驳回', 'task', 1, 1, 36
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_rejected');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'task_pending_review', '待验收提醒', 'task', 1, 1, 37
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'task_pending_review');
