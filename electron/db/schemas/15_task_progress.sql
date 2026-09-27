-- 任务进展表：任务执行过程中的进展记录（学生提交）
-- 幂等：重复执行无副作用。
-- 说明：每次提交一条进展（内容 + 进度百分比快照），任务当前进度取最新一条；
--   附件字段支持上传进展材料。
CREATE TABLE IF NOT EXISTS `task_progress` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id`       INT UNSIGNED NOT NULL                COMMENT '任务 task.id',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '提交人 user.id（执行学生）',
  `content`       TEXT                                 COMMENT '本次进展说明',
  `progress_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本次提交时的进度（0-100）',
  `attachment`    VARCHAR(255) DEFAULT NULL     COMMENT '附件路径',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_task` (`task_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务进展表';
