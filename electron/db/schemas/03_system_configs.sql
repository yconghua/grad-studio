-- 系统参数表：全局键值配置（超级管理员「系统配置」页维护）
-- 幂等：重复执行无副作用。
-- 说明：config_type 预留类型字段，当前统一按字符串处理（string），
--   后续可扩展为 string / number / boolean / json。
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '系统参数ID',
  `config_key`   VARCHAR(100) NOT NULL COMMENT '参数键（唯一）',
  `config_value` TEXT         COMMENT '参数值',
  `config_type`  VARCHAR(20)  NOT NULL DEFAULT 'string' COMMENT '参数类型（预留：string/number/boolean/json）',
  `description`  VARCHAR(255) DEFAULT NULL COMMENT '参数描述',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统参数表';

-- 初始化基础系统参数：仅在对应参数不存在时写入
INSERT INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`)
SELECT 'system.name', '课题组科研管理平台', 'string', '系统名称'
WHERE NOT EXISTS (SELECT 1 FROM `system_configs` WHERE `config_key` = 'system.name');

INSERT INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`)
SELECT 'system.introduction', '课题组科研管理平台：面向高校课题组的协作与管理工具，支持用户管理、课题组设置、成员与师生关系管理。', 'string', '系统简介'
WHERE NOT EXISTS (SELECT 1 FROM `system_configs` WHERE `config_key` = 'system.introduction');
