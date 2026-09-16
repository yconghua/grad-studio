-- 操作日志表（系统设置 → 日志审计，支撑平台全链路追溯）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
--
-- 说明：只追加、不更新、不删除，因此不设 updated_at；
-- username 冗余存账号名，避免用户被删后日志仍可追溯操作人身份。
CREATE TABLE IF NOT EXISTS `operation_log` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      INT UNSIGNED NULL DEFAULT NULL       COMMENT '操作人用户 id（软关联 user.id）',
  `username`     VARCHAR(50)  NULL DEFAULT NULL       COMMENT '操作人账号（冗余，防用户删除后不可追溯）',
  `action`       VARCHAR(50)  NOT NULL                COMMENT '动作：create / update / delete / login / logout 等',
  `target_table` VARCHAR(50)  NULL DEFAULT NULL       COMMENT '目标表名',
  `target_id`    INT UNSIGNED NULL DEFAULT NULL       COMMENT '目标记录 id',
  `detail`       TEXT         NULL                    COMMENT '详情（JSON 文本）',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志（审计追溯）表';
