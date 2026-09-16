-- 活动报名表（协同办公 → 活动报名）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `activity_signup` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id` INT UNSIGNED NOT NULL                COMMENT '活动 id（软关联 activity.id）',
  `user_id`     INT UNSIGNED NOT NULL                COMMENT '报名人用户 id（软关联 user.id）',
  `remark`      VARCHAR(200) NULL DEFAULT NULL       COMMENT '备注',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'signed' COMMENT '状态：signed 已报名 / cancelled 已取消',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_user` (`activity_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动报名表';
