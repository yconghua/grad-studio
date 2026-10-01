-- 课题组表：平台级组织单位（超级管理员「课题组设置」维护）
-- 幂等：重复执行无副作用。
-- 说明：code 为课题组唯一标识号（UUID，由后端生成，前端不可修改）；
--   admin_user_id 唯一，表示一个课题组管理员只能管理一个课题组。
CREATE TABLE IF NOT EXISTS `groups` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '课题组ID',
  `name`          VARCHAR(100) NOT NULL COMMENT '课题组名称',
  `code`          CHAR(36)     NOT NULL COMMENT '课题组唯一标识号（UUID）',
  `description`   VARCHAR(500) DEFAULT NULL COMMENT '课题组描述',
  `admin_user_id` BIGINT       DEFAULT NULL COMMENT '课题组管理员用户ID（唯一）',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1启用，0禁用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  UNIQUE KEY `uk_admin_user_id` (`admin_user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组表';
