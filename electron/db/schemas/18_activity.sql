-- 活动表（协同办公 → 活动报名）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `activity` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`            VARCHAR(200) NOT NULL                COMMENT '活动名称',
  `type`             VARCHAR(30)  NULL DEFAULT NULL       COMMENT '类型（文体 / 学术 / 团建 / 其他）',
  `description`      TEXT         NULL                    COMMENT '活动简介',
  `location`         VARCHAR(100) NULL DEFAULT NULL       COMMENT '地点',
  `start_time`       DATETIME     NULL DEFAULT NULL       COMMENT '开始时间',
  `end_time`         DATETIME     NULL DEFAULT NULL       COMMENT '结束时间',
  `signup_deadline`  DATETIME     NULL DEFAULT NULL       COMMENT '报名截止时间',
  `max_signups`      INT UNSIGNED NULL DEFAULT NULL       COMMENT '报名上限（NULL 不限）',
  `organizer_id`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '组织者用户 id（软关联 user.id）',
  `status`           VARCHAR(20)  NOT NULL DEFAULT 'open' COMMENT '状态：open 报名中 / closed 报名截止 / done 已结束',
  `created_by`       INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动表';
