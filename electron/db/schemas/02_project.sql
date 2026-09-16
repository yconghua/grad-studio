-- 科研项目 / 课题表（科研管理 → 项目管理 / 课题申报）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
--
-- 说明：课题申报与科研项目共用一张表，用 type 字段区分（project 科研项目 / subject 课题申报）。
CREATE TABLE IF NOT EXISTS `project` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`        VARCHAR(200) NOT NULL                COMMENT '项目名称',
  `code`        VARCHAR(50)  NULL DEFAULT NULL       COMMENT '项目编号 / 课题编号',
  `type`        VARCHAR(20)  NOT NULL DEFAULT 'project' COMMENT '类型：project 科研项目 / subject 课题申报',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'ongoing' COMMENT '状态：ongoing 进行中 / done 已结题 / paused 已暂停',
  `level`       VARCHAR(30)  NULL DEFAULT NULL       COMMENT '级别（国家级 / 省部级 / 市级 / 校级 / 横向 / 其他）',
  `source`      VARCHAR(100) NULL DEFAULT NULL       COMMENT '经费来源 / 立项部门',
  `budget`      DECIMAL(14,2) NULL DEFAULT NULL      COMMENT '总经费（元）',
  `leader_id`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '负责人用户 id（软关联 user.id）',
  `description` TEXT         NULL                    COMMENT '项目简介 / 研究内容',
  `start_date`  DATE         NULL DEFAULT NULL       COMMENT '开始日期',
  `end_date`    DATE         NULL DEFAULT NULL       COMMENT '结束日期',
  `created_by`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_leader_id` (`leader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研项目/课题表';
