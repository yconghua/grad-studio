-- 入组离组申请表（工作室事务 → 入组离组）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `join_leave` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      INT UNSIGNED NOT NULL                COMMENT '申请人用户 id（软关联 user.id）',
  `type`         VARCHAR(20)  NOT NULL                COMMENT '类型：join 入组 / leave 离组',
  `reason`       VARCHAR(500) NULL DEFAULT NULL       COMMENT '申请原因',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending 待审核 / approved 已通过 / rejected 已驳回',
  `apply_date`   DATE         NULL DEFAULT NULL       COMMENT '申请日期',
  `handler_id`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '审核人用户 id（软关联 user.id）',
  `handle_time`  DATETIME     NULL DEFAULT NULL       COMMENT '审核时间',
  `handle_remark` VARCHAR(500) NULL DEFAULT NULL      COMMENT '审核意见',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入组离组申请表';
