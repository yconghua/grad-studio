-- 学生学位节点记录表：每个学生在各学位节点上的完成情况
-- 幂等：重复执行无副作用。
-- 说明：组管可维护全体学生记录，导师可维护名下学生记录；
--   记录学生与节点一一对应（唯一索引），状态流转：not_started → in_progress → completed。
CREATE TABLE IF NOT EXISTS `student_degree` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `student_id`    INT UNSIGNED NOT NULL                COMMENT '学生 user.id',
  `node_id`       INT UNSIGNED NOT NULL                COMMENT '学位节点 degree_node.id',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'not_started' COMMENT '状态：not_started 未开始 / in_progress 进行中 / completed 已完成 / failed 未通过',
  `complete_date` DATE                                 COMMENT '完成日期',
  `score`         DECIMAL(5,2)                         COMMENT '考核成绩 / 评分',
  `remark`        VARCHAR(500) DEFAULT NULL     COMMENT '备注',
  `updated_by`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '最后维护人 user.id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_student_node` (`student_id`, `node_id`),
  KEY `idx_node` (`node_id`),
  KEY `idx_group_status` (`group_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生学位节点记录表';
