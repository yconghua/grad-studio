-- 科研项目 / 项目成员 / 里程碑（模块3 项目与任务协作）
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `project` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`       VARCHAR(50)   NOT NULL                COMMENT '项目编号，唯一',
  `name`       VARCHAR(150)  NOT NULL                COMMENT '项目名称',
  `type`       VARCHAR(20)   NOT NULL DEFAULT '纵向'  COMMENT '类型：纵向 / 横向 / 校级 / 企业合作',
  `leader_id`  INT UNSIGNED  DEFAULT NULL            COMMENT '负责人 member.id',
  `start_date` DATE          DEFAULT NULL            COMMENT '开始日期',
  `end_date`   DATE          DEFAULT NULL            COMMENT '结束日期',
  `budget`     DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '项目经费总额',
  `stage`      VARCHAR(20)   NOT NULL DEFAULT '申报'  COMMENT '阶段：申报 / 立项 / 进行中 / 结题 / 归档',
  `intro`      TEXT          DEFAULT NULL            COMMENT '项目简介',
  `is_deleted` TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_leader` (`leader_id`),
  KEY `idx_stage` (`stage`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研项目表';

CREATE TABLE IF NOT EXISTS `project_member` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id`      INT UNSIGNED NOT NULL                COMMENT '项目 id',
  `member_id`       INT UNSIGNED NOT NULL                COMMENT '成员 id',
  `role_in_project` VARCHAR(20)  NOT NULL DEFAULT '参与人' COMMENT '项目内角色：负责人 / 参与人',
  `join_date`       DATE         DEFAULT NULL            COMMENT '加入日期',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_project_member` (`project_id`, `member_id`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目成员表';

CREATE TABLE IF NOT EXISTS `project_milestone` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id`  INT UNSIGNED NOT NULL                COMMENT '项目 id',
  `name`        VARCHAR(150) NOT NULL                COMMENT '节点名称',
  `plan_date`   DATE         DEFAULT NULL            COMMENT '计划完成日期',
  `actual_date` DATE         DEFAULT NULL            COMMENT '实际完成日期',
  `status`      VARCHAR(20)  NOT NULL DEFAULT '未完成' COMMENT '状态：未完成 / 已完成 / 已延期',
  `remind_days` INT          NOT NULL DEFAULT 3      COMMENT '提前几天提醒，0 表示不提醒',
  `note`        VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_status` (`status`),
  KEY `idx_plan_date` (`plan_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目里程碑表';
