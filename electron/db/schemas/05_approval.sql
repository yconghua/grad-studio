-- 审批中心（地基，被 5 处业务共用）
-- 采用「单级审批」：提交后由任意管理员通过或驳回一次即办结。
-- approval_record.step 字段保留（单级恒为 1），将来要扩多级审批无需改表结构。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `approval_order` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no`     VARCHAR(40)  NOT NULL                COMMENT '单号，唯一，如 AP20260915001',
  `biz_type`     VARCHAR(20)  NOT NULL                COMMENT '业务类型：入组 / 离组 / 请假 / 设备借用 / 报销 / 成果',
  `biz_id`       INT UNSIGNED NOT NULL                COMMENT '业务表主键',
  `title`        VARCHAR(150) NOT NULL                COMMENT '审批单标题',
  `summary`      VARCHAR(500) DEFAULT NULL            COMMENT '摘要，列表展示用，避免逐条回查业务表',
  `applicant_id` INT UNSIGNED NOT NULL                COMMENT '申请人 member.id',
  `status`       VARCHAR(20)  NOT NULL DEFAULT '待审批' COMMENT '状态：待审批 / 已通过 / 已驳回 / 已撤销',
  `approver_id`  INT UNSIGNED DEFAULT NULL            COMMENT '最终处理人 member.id',
  `apply_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `finish_time`  DATETIME     DEFAULT NULL            COMMENT '办结时间',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_biz` (`biz_type`, `biz_id`),
  KEY `idx_applicant` (`applicant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批单表';

CREATE TABLE IF NOT EXISTS `approval_record` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`    INT UNSIGNED NOT NULL                COMMENT '审批单 id',
  `step`        INT          NOT NULL DEFAULT 1      COMMENT '步骤序号，单级审批恒为 1',
  `approver_id` INT UNSIGNED NOT NULL                COMMENT '审批人 member.id',
  `action`      VARCHAR(20)  NOT NULL                COMMENT '动作：通过 / 驳回 / 撤销',
  `comment`     VARCHAR(500) DEFAULT NULL            COMMENT '审批意见',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批记录表';
