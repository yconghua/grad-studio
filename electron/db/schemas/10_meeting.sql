-- 组会表：课题组组会 / 例会（组管创建，导师参与，学生报名与汇报）
-- 幂等：重复执行无副作用。
-- 说明：组会状态流转：draft 草稿 → published 已发布（学生可见可报） → finished 已结束 / cancelled 已取消。
CREATE TABLE IF NOT EXISTS `meeting` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `title`         VARCHAR(200) NOT NULL                COMMENT '组会主题',
  `meeting_type`  VARCHAR(20)  NOT NULL DEFAULT 'regular' COMMENT '类型：regular 常规组会 / seminar 专题研讨 / thesis 开题答辩 / other 其他',
  `location`      VARCHAR(200) NOT NULL DEFAULT ''     COMMENT '地点（线下地址或线上会议链接）',
  `start_time`    DATETIME                             COMMENT '开始时间',
  `end_time`      DATETIME                             COMMENT '结束时间',
  `host_id`       INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '主持人 user.id（组管或导师，0 未指定）',
  `agenda`        TEXT                                 COMMENT '议程 / 议题说明',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'draft' COMMENT '状态：draft 草稿 / published 已发布 / finished 已结束 / cancelled 已取消',
  `created_by`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '创建人 user.id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_group_status` (`group_id`, `status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_host` (`host_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会表';
