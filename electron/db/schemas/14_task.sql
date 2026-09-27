-- 任务表：课题任务下发（组管 / 导师指派给名下学生）
-- 幂等：重复执行无副作用。
-- 说明：任务可挂靠课题（subject_id）或组内独立下发；progress_percent 为当前进度快照，
--   进展明细记录在 task_progress 表；状态：todo → in_progress → completed / cancelled。
CREATE TABLE IF NOT EXISTS `task` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `subject_id`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '关联课题 subject.id（0 表示不挂课题）',
  `title`         VARCHAR(200) NOT NULL                COMMENT '任务标题',
  `description`   TEXT                                 COMMENT '任务说明 / 要求',
  `assigner_id`   INT UNSIGNED NOT NULL                COMMENT '下发人 user.id（组管或导师）',
  `assignee_id`   INT UNSIGNED NOT NULL                COMMENT '执行人 user.id（学生）',
  `priority`      VARCHAR(10)  NOT NULL DEFAULT 'medium' COMMENT '优先级：high 高 / medium 中 / low 低',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'todo' COMMENT '状态：todo 待办 / in_progress 进行中 / completed 已完成 / cancelled 已取消',
  `progress_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当前进度（0-100）',
  `deadline`      DATETIME                             COMMENT '截止时间',
  `completed_at`  DATETIME                             COMMENT '完成时间',
  `remark`        VARCHAR(500) DEFAULT NULL     COMMENT '备注',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_subject` (`subject_id`),
  KEY `idx_assignee_status` (`assignee_id`, `status`),
  KEY `idx_assigner` (`assigner_id`),
  KEY `idx_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表';
