-- 卫生值日 / 值班排班表（工作室事务 → 卫生排班）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `duty` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type`       VARCHAR(20)  NOT NULL DEFAULT 'clean' COMMENT '类型：clean 卫生值日 / duty 值班',
  `duty_date`  DATE         NOT NULL                COMMENT '排班日期',
  `user_id`    INT UNSIGNED NOT NULL                COMMENT '值日 / 值班人用户 id（软关联 user.id）',
  `content`    VARCHAR(200) NULL DEFAULT NULL       COMMENT '任务说明',
  `status`     VARCHAR(20)  NULL DEFAULT NULL       COMMENT '完成状态：pending 待完成 / done 已完成',
  `created_by` INT UNSIGNED NULL DEFAULT NULL       COMMENT '排班人用户 id',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_duty_date` (`duty_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卫生值日/值班排班表';
