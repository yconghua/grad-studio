-- 导师学生关系表：导师「我的学生」数据来源
-- 幂等：重复执行无副作用。
-- 说明：一条记录表示「某导师指导某学生」；导师只能查看 / 管理本表名下学生。
--   学生离师通过 status 表达（quit），历史关系保留。
CREATE TABLE IF NOT EXISTS `mentor_student` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `mentor_id`     INT UNSIGNED NOT NULL                COMMENT '导师 user.id',
  `student_id`    INT UNSIGNED NOT NULL                COMMENT '学生 user.id',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active 指导中 / quit 已离师',
  `remark`        VARCHAR(255) DEFAULT NULL     COMMENT '备注',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_mentor_student` (`mentor_id`, `student_id`),
  KEY `idx_student` (`student_id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='导师学生关系表';
