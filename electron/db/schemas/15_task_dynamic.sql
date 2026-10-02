-- 任务动态表：任务全生命周期动作留痕（唯一留痕载体，不做独立审计表）
-- 幂等：重复执行无副作用。
-- 说明：记录创建/编辑/分配/移除参与人/提交进展/状态变更/验收/删除/恢复；
--   动态不可单独删除，随任务软删级联软删（is_deleted=1）保留。
CREATE TABLE IF NOT EXISTS `task_dynamic` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '动态ID',
  `task_id`     BIGINT       NOT NULL COMMENT '任务ID',
  `operator_id` BIGINT       NOT NULL COMMENT '操作人用户ID',
  `action`      VARCHAR(32)  NOT NULL COMMENT '动作：create/update/assign/remove/progress/status_change/verify_approve/verify_reject/delete/restore',
  `from_status` TINYINT      DEFAULT NULL COMMENT '原状态',
  `to_status`   TINYINT      DEFAULT NULL COMMENT '新状态',
  `detail`      VARCHAR(500) DEFAULT NULL COMMENT '动态详情',
  `is_deleted`  TINYINT      NOT NULL DEFAULT 0 COMMENT '软删标记：0正常，1已删除（随任务级联）',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_task` (`task_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务动态表';
