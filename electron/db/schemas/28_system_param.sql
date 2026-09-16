-- 系统参数表（系统设置 → 系统参数）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `system_param` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `param_key`   VARCHAR(100) NOT NULL                COMMENT '参数键（唯一）',
  `param_value` TEXT         NULL                    COMMENT '参数值',
  `description` VARCHAR(200) NULL DEFAULT NULL       COMMENT '说明',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_param_key` (`param_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统参数表';
