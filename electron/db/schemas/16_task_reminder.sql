-- 任务提醒表：定时扫描去重（防止到期/逾期/待验收提醒重复轰炸）
-- 幂等：重复执行无副作用。
-- 说明：同一任务+同一用户+同一提醒类型+同一日期只允许一条（唯一约束兜底幂等）；
--   扫描器插入时冲突即跳过该轮。
CREATE TABLE IF NOT EXISTS `task_reminder` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '提醒记录ID',
  `task_id`     BIGINT      NOT NULL COMMENT '任务ID',
  `user_id`     BIGINT      NOT NULL COMMENT '接收人用户ID',
  `remind_type` VARCHAR(32) NOT NULL COMMENT '提醒类型：due_soon/overdue/pending_review',
  `remind_date` DATE        NOT NULL COMMENT '提醒日期（按天去重）',
  `sent_at`     DATETIME    DEFAULT NULL COMMENT '通知写入时间',
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_user_type_date` (`task_id`, `user_id`, `remind_type`, `remind_date`),
  KEY `idx_sent` (`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务提醒去重表';
