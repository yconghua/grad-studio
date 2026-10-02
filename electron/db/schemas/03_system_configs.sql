-- 系统参数表：全局键值配置（超级管理员「系统配置」页维护）
-- 幂等：重复执行无副作用。
-- 说明：config_type 实际支持 string / number / boolean / json，存储前按类型校验与归一。
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '系统参数ID',
  `config_key`   VARCHAR(100) NOT NULL COMMENT '参数键（唯一）',
  `config_value` TEXT         COMMENT '参数值',
  `config_type`  VARCHAR(20)  NOT NULL DEFAULT 'string' COMMENT '参数类型：string/number/boolean/json',
  `description`  VARCHAR(255) DEFAULT NULL COMMENT '参数描述',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统参数表';

-- 初始化基础系统参数：仅在对应参数不存在时写入
INSERT INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`)
SELECT 'system.name', 'TEST平台', 'string', '系统名称'
WHERE NOT EXISTS (SELECT 1 FROM `system_configs` WHERE `config_key` = 'system.name');

INSERT INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`)
SELECT 'system.introduction', 'TEST平台：面向高校的协作与管理工具，支持用户管理、课题组设置、成员与师生关系管理。', 'string', '系统简介'
WHERE NOT EXISTS (SELECT 1 FROM `system_configs` WHERE `config_key` = 'system.introduction');

INSERT INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`)
SELECT 'task.due_soon_hours', '24', 'number', '任务即将到期提前提醒小时数（定时扫描用）'
WHERE NOT EXISTS (SELECT 1 FROM `system_configs` WHERE `config_key` = 'task.due_soon_hours');

INSERT INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`)
SELECT 'task.pending_review_hours', '24', 'number', '任务待验收超时提醒小时数（定时扫描用）'
WHERE NOT EXISTS (SELECT 1 FROM `system_configs` WHERE `config_key` = 'task.pending_review_hours');
