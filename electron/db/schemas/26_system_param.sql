-- 系统参数表：全局键值配置（超级管理员「系统配置」页）
-- 幂等：重复执行无副作用。
-- 说明：全局参数由超管维护（如平台名称、默认密码策略、开关项等），
--   param_key 全局唯一；前端按需读取。
CREATE TABLE IF NOT EXISTS `system_param` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `param_key`     VARCHAR(100) NOT NULL                COMMENT '参数键（唯一）',
  `param_value`   TEXT                                 COMMENT '参数值',
  `description`   VARCHAR(200) DEFAULT NULL     COMMENT '参数说明',
  `updated_by`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '最后修改人 user.id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_param_key` (`param_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统参数表';
