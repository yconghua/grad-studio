-- 个人待办表（工作台 → 待办事项）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `todo` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`       VARCHAR(200) NOT NULL                COMMENT '待办标题',
  `description` TEXT         NULL                    COMMENT '待办描述',
  `user_id`     INT UNSIGNED NOT NULL                COMMENT '所属用户 id（软关联 user.id）',
  `priority`    VARCHAR(10)  NOT NULL DEFAULT 'medium' COMMENT '优先级：high 高 / medium 中 / low 低',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending 未完成 / done 已完成',
  `due_date`    DATE         NULL DEFAULT NULL       COMMENT '截止日期',
  `done_at`     DATETIME     NULL DEFAULT NULL       COMMENT '完成时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='个人待办表';
