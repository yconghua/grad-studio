-- 工作室信息 / 工位 / 工位分配记录（模块2 工作室与成员管理）
-- studio 为「单工作室」设计，全表只保留 1 行，管理员可直接编辑该行。
-- 幂等：CREATE TABLE IF NOT EXISTS + 默认行按「表为空才插入」写入。

CREATE TABLE IF NOT EXISTS `studio` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`                VARCHAR(100) NOT NULL                COMMENT '工作室名称',
  `intro`               TEXT         DEFAULT NULL            COMMENT '工作室简介',
  `founded_date`        DATE         DEFAULT NULL            COMMENT '成立时间',
  `college`             VARCHAR(100) DEFAULT NULL            COMMENT '所属学院',
  `leader_id`           INT UNSIGNED DEFAULT NULL            COMMENT '负责人 member.id',
  `rules`               TEXT         DEFAULT NULL            COMMENT '规章制度',
  `research_directions` VARCHAR(255) DEFAULT NULL            COMMENT '研究方向，多个用逗号分隔',
  `location`            VARCHAR(150) DEFAULT NULL            COMMENT '实验室地点',
  `door_access`         VARCHAR(150) DEFAULT NULL            COMMENT '门禁信息',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_leader` (`leader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作室信息表（单工作室，仅 1 行）';

CREATE TABLE IF NOT EXISTS `workstation` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`              VARCHAR(30)  NOT NULL                COMMENT '工位号，唯一，如 A-01',
  `area`              VARCHAR(50)  DEFAULT NULL            COMMENT '区域或分区',
  `status`            VARCHAR(20)  NOT NULL DEFAULT '空闲'  COMMENT '状态：空闲 / 使用中 / 维修中',
  `current_member_id` INT UNSIGNED DEFAULT NULL            COMMENT '当前使用者 member.id，空闲时为空',
  `note`              VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `is_deleted`        TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_current_member` (`current_member_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工位表';

CREATE TABLE IF NOT EXISTS `workstation_assign` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `workstation_id` INT UNSIGNED NOT NULL                COMMENT '工位 id',
  `member_id`      INT UNSIGNED NOT NULL                COMMENT '成员 id',
  `start_date`     DATE         NOT NULL                COMMENT '生效日期',
  `end_date`       DATE         DEFAULT NULL            COMMENT '结束日期，空表示仍在使用',
  `status`         VARCHAR(20)  NOT NULL DEFAULT '生效'  COMMENT '状态：生效 / 已结束',
  `operator_id`    INT UNSIGNED DEFAULT NULL            COMMENT '操作人 member.id',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_workstation` (`workstation_id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工位分配记录表';

INSERT INTO `studio` (`name`, `intro`, `college`, `research_directions`, `location`)
SELECT '研究生工作室', '请在「工作室与成员管理 - 工作室信息」中完善本工作室的简介、规章制度与研究方向。', '待填写', '待填写', '待填写'
WHERE NOT EXISTS (SELECT 1 FROM `studio`);
