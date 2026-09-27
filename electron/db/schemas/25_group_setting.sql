-- 课题组配置表：课题组级键值配置（课题组设置页，组管维护）
-- 幂等：重复执行无副作用。
-- 说明：键值对模型，扩展灵活；config_key 在同一课题组内唯一，
--   常见项如公告默认置顶、组会默认时长、周报截止日等。
CREATE TABLE IF NOT EXISTS `group_setting` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `config_key`    VARCHAR(100) NOT NULL                COMMENT '配置键',
  `config_value`  TEXT                                 COMMENT '配置值',
  `description`   VARCHAR(200) NOT NULL DEFAULT ''     COMMENT '配置说明',
  `updated_by`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '最后修改人 user.id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_group_key` (`group_id`, `config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组配置表';
