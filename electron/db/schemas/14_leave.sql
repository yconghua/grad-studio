-- 请假申请（模块8 考勤、值班与请假 - 请假管理）
-- 请假审批走统一审批单，本表只存 approval_id 关联，不重复存审批人 / 审批意见。
-- 销假不新建记录，回填本表的 cancel_time 与 cancel_remark，状态改为「已销假」。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `leave_apply` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_id`     INT UNSIGNED NOT NULL                COMMENT '申请人 member.id',
  `type`          VARCHAR(20)  NOT NULL DEFAULT '事假'  COMMENT '类型：事假 / 病假 / 外出 / 出差',
  `start_time`    DATETIME     NOT NULL                COMMENT '请假开始时间',
  `end_time`      DATETIME     NOT NULL                COMMENT '请假结束时间',
  `days`          DECIMAL(5,1) NOT NULL DEFAULT 0.0    COMMENT '请假天数',
  `reason`        VARCHAR(500) DEFAULT NULL            COMMENT '请假事由',
  `approval_id`   INT UNSIGNED DEFAULT NULL            COMMENT '关联审批单 approval_order.id',
  `status`        VARCHAR(20)  NOT NULL DEFAULT '待审批' COMMENT '状态：待审批 / 已通过 / 已驳回 / 已销假 / 已撤销',
  `cancel_time`   DATETIME     DEFAULT NULL            COMMENT '销假时间',
  `cancel_remark` VARCHAR(255) DEFAULT NULL            COMMENT '销假说明',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_approval` (`approval_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='请假申请表';
