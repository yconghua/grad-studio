-- 系统操作日志表：全平台操作审计（超级管理员「系统操作日志」页）
-- 幂等：重复执行无副作用。
-- 说明：记录登录 / 退出 / 增删改等关键操作；只追加不修改，
--   operator_id / target_type / target_id 便于按操作者与对象检索。
CREATE TABLE IF NOT EXISTS `operation_log` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `operator_id`   INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '操作人 user.id',
  `operator_name` VARCHAR(50)  DEFAULT NULL     COMMENT '操作人账号（冗余便于展示）',
  `action`        VARCHAR(30)  NOT NULL                COMMENT '动作：login 登录 / logout 退出 / create 新增 / update 修改 / delete 删除 / export 导出 / other 其他',
  `target_type`   VARCHAR(50)  DEFAULT NULL     COMMENT '操作对象类型（如 user / group / notice / meeting）',
  `target_id`     INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '操作对象 id',
  `detail`        TEXT                                 COMMENT '操作详情（JSON 或文本）',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_operator` (`operator_id`),
  KEY `idx_target` (`target_type`, `target_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作日志表';
