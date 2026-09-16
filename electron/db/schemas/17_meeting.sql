-- 组会表（协同办公 → 组会管理）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
--
-- 说明：参会人以逗号分隔文本存于 attendees 字段（如用户姓名 / 账号），
-- 组会参与人无需强关联查询，故不单独建关联表。
CREATE TABLE IF NOT EXISTS `meeting` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200) NOT NULL                COMMENT '会议主题',
  `type`         VARCHAR(30)  NULL DEFAULT NULL       COMMENT '类型（周会 / 学术研讨 / 专题）',
  `meeting_date` DATETIME     NULL DEFAULT NULL       COMMENT '会议时间',
  `location`     VARCHAR(100) NULL DEFAULT NULL       COMMENT '地点',
  `host_id`      INT UNSIGNED NULL DEFAULT NULL       COMMENT '主持人用户 id（软关联 user.id）',
  `attendees`    VARCHAR(500) NULL DEFAULT NULL       COMMENT '参会人（逗号分隔文本）',
  `summary`      TEXT         NULL                    COMMENT '会议纪要',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'scheduled' COMMENT '状态：scheduled 已排期 / done 已召开 / cancelled 已取消',
  `created_by`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_meeting_date` (`meeting_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会表';
