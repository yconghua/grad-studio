-- 课题成员表：课题参与者（学生等）与角色
-- 幂等：重复执行无副作用。
-- 说明：课题负责人已在 subject.leader_id 记录，本表记录其余参与成员；
--   同一用户在同一课题只保留一条记录（唯一索引），退出通过 status 表达。
CREATE TABLE IF NOT EXISTS `subject_member` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `subject_id`    INT UNSIGNED NOT NULL                COMMENT '课题 subject.id',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '成员 user.id',
  `role_in_subject` VARCHAR(20) NOT NULL DEFAULT 'member' COMMENT '课题内角色：leader 负责人 / member 参与人',
  `join_date`     DATE                                 COMMENT '加入日期',
  `quit_date`     DATE                                 COMMENT '退出日期',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active 参与中 / quit 已退出',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_subject_user` (`subject_id`, `user_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题成员表';
