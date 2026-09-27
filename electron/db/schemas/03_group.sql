-- 课题组表：平台级组织单位（超级管理员「课题组管理」维护）
-- 幂等：重复执行无副作用。
-- 说明：课题组启停由超管控制；组内业务（公告 / 组会 / 课题等）均以 group_id 归属。
CREATE TABLE IF NOT EXISTS `group` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`          VARCHAR(100) NOT NULL                COMMENT '课题组名称',
  `code`          VARCHAR(30)  NOT NULL                COMMENT '课题组编号（唯一）',
  `description`   TEXT                                 COMMENT '课题组简介',
  `leader_id`     INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '课题组负责人 user.id（可为导师或组管，0 表示未指定）',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active 正常 / disabled 已停用',
  `created_by`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '创建人 user.id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_leader` (`leader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组表';
