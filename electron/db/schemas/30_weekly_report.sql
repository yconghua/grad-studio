-- 周报表（协同办公 → 周报管理）
-- 学生按周提交：本周进展 / 遇到问题 / 下周计划；导师在线批注、打分。
-- 状态机：draft 草稿 → submitted 已提交 → reviewed 已批注 → archived 已归档。
CREATE TABLE IF NOT EXISTS `weekly_report` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `student_id`     INT UNSIGNED NOT NULL                COMMENT '提交学生用户 id',
  `week_start`    DATE         NOT NULL                COMMENT '本周一日期',
  `week_end`      DATE         NOT NULL                COMMENT '本周日日期',
  `progress`      TEXT         NULL                    COMMENT '本周进展',
  `issues`        TEXT         NULL                    COMMENT '遇到的问题',
  `plan_next`     TEXT         NULL                    COMMENT '下周计划',
  `attachment`    VARCHAR(500) NULL DEFAULT NULL       COMMENT '附件路径（可选）',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'draft' COMMENT '状态：draft/submitted/reviewed/archived',
  `mentor_comment` TEXT        NULL                    COMMENT '导师批注',
  `mentor_score`  TINYINT UNSIGNED NULL DEFAULT NULL   COMMENT '导师打分（0-100）',
  `mentor_id`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '批注导师 id',
  `reviewed_at`   DATETIME     NULL DEFAULT NULL       COMMENT '批注时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_week` (`student_id`, `week_start`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报表';
