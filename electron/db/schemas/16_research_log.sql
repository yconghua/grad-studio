-- 科研日志表：学生日常科研记录（科研记录页）
-- 幂等：重复执行无副作用。
-- 说明：学生按日填写科研日志，可打标签归类；内容为研究进展 / 问题 / 思考等。
CREATE TABLE IF NOT EXISTS `research_log` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `student_id`    INT UNSIGNED NOT NULL                COMMENT '学生 user.id',
  `log_date`      DATE         NOT NULL                COMMENT '日志日期',
  `content`       TEXT                                 COMMENT '日志内容',
  `tags`          VARCHAR(255) DEFAULT NULL     COMMENT '标签（逗号分隔，如 实验,阅读,写作）',
  `attachment`    VARCHAR(255) DEFAULT NULL     COMMENT '附件路径',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_student_date` (`student_id`, `log_date`),
  KEY `idx_tags` (`tags`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研日志表';
