-- 周报表：学生每周科研周报（提交后导师 / 组管可查看）
-- 幂等：重复执行无副作用。
-- 说明：按自然周填报（week_start / week_end），状态：draft 草稿 → submitted 已提交 → reviewed 已批阅；
--   周报同时作为「科研档案」时间轴与 AI 助手总结的数据来源。
CREATE TABLE IF NOT EXISTS `weekly_report` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `student_id`    INT UNSIGNED NOT NULL                COMMENT '学生 user.id',
  `week_start`    DATE         NOT NULL                COMMENT '周起始日（周一）',
  `week_end`      DATE         NOT NULL                COMMENT '周结束日（周日）',
  `work_content`  TEXT                                 COMMENT '本周完成工作',
  `plan_content`  TEXT                                 COMMENT '下周计划',
  `problem_content` TEXT                               COMMENT '遇到的问题 / 求助事项',
  `attachment`    VARCHAR(255) DEFAULT NULL     COMMENT '附件路径',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'draft' COMMENT '状态：draft 草稿 / submitted 已提交 / reviewed 已批阅',
  `submitted_at`  DATETIME                             COMMENT '提交时间',
  `reviewed_by`   INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '批阅人 user.id',
  `review_comment` VARCHAR(500) DEFAULT NULL    COMMENT '批阅意见',
  `reviewed_at`   DATETIME                             COMMENT '批阅时间',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_student_week` (`student_id`, `week_start`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报表';
