-- 通知类型注册表：通知中心可扩展的关键。
-- 新功能上线时在此注册一条（type_key / 显示名称 / 图标键 / 是否支持系统通知 / 排序），
-- 通知中心的存储、展示、筛选、系统通知自动支持，代码零改动。
-- 本表不存跳转路由：四角色路由前缀不同，前端维护「类型 → 按角色拼路由」映射。
-- 幂等：重复执行无副作用（种子仅在该类型不存在时写入）。
CREATE TABLE IF NOT EXISTS `notification_type` (
  `id`                  BIGINT      NOT NULL AUTO_INCREMENT COMMENT '类型ID',
  `type_key`            VARCHAR(32) NOT NULL COMMENT '类型标识（唯一，业务侧 createForUsers 传入）',
  `display_name`        VARCHAR(32) NOT NULL COMMENT '显示名称（列表筛选 / 项展示用）',
  `icon_key`            VARCHAR(32) NOT NULL DEFAULT '' COMMENT '图标键（前端映射图标）',
  `allow_system_notify` TINYINT     NOT NULL DEFAULT 1 COMMENT '是否支持系统通知：1支持，0不支持',
  `enabled`             TINYINT     NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0禁用（禁用后不产生新通知，历史保留）',
  `sort_order`          INT         NOT NULL DEFAULT 0 COMMENT '排序（小在前）',
  `created_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_key` (`type_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知类型注册表';

-- 种子：公告、组会（仅在该类型不存在时写入，重复执行无副作用）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'notice',  '公告', 'notice',  1, 1, 10
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'notice');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'meeting', '组会', 'meeting', 1, 1, 20
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'meeting');
