-- 任务参与人表：任务与参与人的关系
-- 幂等：重复执行无副作用。
-- 说明：同一任务同一用户唯一（UNIQUE）；移除参与人为硬删除（先例同组会参与人），
--   故唯一约束可安全使用，移除后重新添加不受历史记录影响。
CREATE TABLE IF NOT EXISTS `task_participant` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '参与记录ID',
  `task_id`     BIGINT   NOT NULL COMMENT '任务ID',
  `user_id`     BIGINT   NOT NULL COMMENT '参与人用户ID',
  `status`      TINYINT  NOT NULL DEFAULT 1 COMMENT '参与状态：1参与中，2已完成',
  `finish_time` DATETIME DEFAULT NULL COMMENT '完成时间（验收通过时写入）',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_user` (`task_id`, `user_id`),
  KEY `idx_user_status` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务参与人表';
