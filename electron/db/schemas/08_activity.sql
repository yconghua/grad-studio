-- 组会与活动 / 汇报人 / 报名签到 / 纪要总结（模块4 组会与活动）
-- 组会（例行组会、文献分享、开题、中期、预答辩）与活动（讲座、竞赛、团建、调研）字段高度重合，
-- 故合并为一张 activity 表，用 type 字段区分，避免维护两套几乎相同的表与代码。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `activity` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type`             VARCHAR(20)  NOT NULL DEFAULT '例行组会' COMMENT '类型：例行组会 / 文献分享 / 开题 / 中期 / 预答辩 / 学术讲座 / 竞赛 / 团建 / 外出调研',
  `title`            VARCHAR(150) NOT NULL                COMMENT '主题',
  `topic`            VARCHAR(255) DEFAULT NULL            COMMENT '议题',
  `start_time`       DATETIME     NOT NULL                COMMENT '开始时间',
  `end_time`         DATETIME     DEFAULT NULL            COMMENT '结束时间',
  `location`         VARCHAR(150) DEFAULT NULL            COMMENT '地点',
  `host_id`          INT UNSIGNED DEFAULT NULL            COMMENT '主持人 member.id',
  `reminder_minutes` INT          NOT NULL DEFAULT 30     COMMENT '提前多少分钟发提醒，0 表示不提醒',
  `status`           VARCHAR(20)  NOT NULL DEFAULT '待进行' COMMENT '状态：待进行 / 进行中 / 已结束 / 已取消',
  `is_deleted`       TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  KEY `idx_host` (`host_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会与活动表';

CREATE TABLE IF NOT EXISTS `activity_reporter` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id` INT UNSIGNED NOT NULL                COMMENT '活动 id',
  `member_id`   INT UNSIGNED NOT NULL                COMMENT '汇报人 member.id',
  `topic`       VARCHAR(255) DEFAULT NULL            COMMENT '汇报题目',
  `sort_order`  INT          NOT NULL DEFAULT 0      COMMENT '汇报顺序',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会汇报人表';

CREATE TABLE IF NOT EXISTS `activity_participant` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id` INT UNSIGNED NOT NULL                COMMENT '活动 id',
  `member_id`   INT UNSIGNED NOT NULL                COMMENT '成员 id',
  `signed_up`   TINYINT      NOT NULL DEFAULT 0      COMMENT '是否已报名：0 未报名 / 1 已报名',
  `sign_status` VARCHAR(20)  DEFAULT NULL            COMMENT '签到结果：已签到 / 请假 / 迟到 / 缺席',
  `sign_time`   DATETIME     DEFAULT NULL            COMMENT '签到时间',
  `remark`      VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_member` (`activity_id`, `member_id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_sign_status` (`sign_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动报名与签到表';

CREATE TABLE IF NOT EXISTS `activity_summary` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id` INT UNSIGNED NOT NULL                COMMENT '活动 id',
  `content`     TEXT         DEFAULT NULL            COMMENT '讨论内容或活动总结',
  `todo_list`   TEXT         DEFAULT NULL            COMMENT '待办事项，一行一条，可一键转为任务',
  `creator_id`  INT UNSIGNED DEFAULT NULL            COMMENT '记录人 member.id',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_activity` (`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会纪要与活动总结表';
