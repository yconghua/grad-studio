-- 审批中心表（协同办公 → 审批中心）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `approval` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200) NOT NULL                COMMENT '审批标题',
  `type`         VARCHAR(30)  NULL DEFAULT NULL       COMMENT '类型（请假 / 报销 / 借用 / 其他）',
  `content`      TEXT         NULL                    COMMENT '审批内容 / 事由',
  `applicant_id` INT UNSIGNED NOT NULL                COMMENT '申请人用户 id（软关联 user.id）',
  `approver_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '审批人用户 id（软关联 user.id）',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending 待审批 / approved 已通过 / rejected 已驳回',
  `apply_time`   DATETIME     NULL DEFAULT NULL       COMMENT '申请时间',
  `handle_time`  DATETIME     NULL DEFAULT NULL       COMMENT '审批时间',
  `handle_remark` VARCHAR(500) NULL DEFAULT NULL      COMMENT '审批意见',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_applicant_id` (`applicant_id`),
  KEY `idx_approver_id` (`approver_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批中心表';
