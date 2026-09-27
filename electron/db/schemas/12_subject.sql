-- 课题表：课题组科研课题（组管 / 导师管理，学生参与）
-- 幂等：重复执行无副作用。
-- 说明：课题负责人（leader_id）通常为导师；学生参与关系见 subject_member 表；
--   课题状态：applying 申报中 → ongoing 进行中 → completed 已结题 / suspended 已中止。
CREATE TABLE IF NOT EXISTS `subject` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `name`          VARCHAR(200) NOT NULL                COMMENT '课题名称',
  `code`          VARCHAR(50)  NOT NULL DEFAULT ''     COMMENT '课题编号（立项编号，可空）',
  `subject_type`  VARCHAR(20)  NOT NULL DEFAULT 'self' COMMENT '类型：national 国家级 / provincial 省部级 / school 校级 / enterprise 横向 / self 自选',
  `description`   TEXT                                 COMMENT '课题简介 / 研究内容',
  `leader_id`     INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '课题负责人 user.id（导师）',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'applying' COMMENT '状态：applying 申报中 / ongoing 进行中 / completed 已结题 / suspended 已中止',
  `start_date`    DATE                                 COMMENT '开始日期',
  `end_date`      DATE                                 COMMENT '结束日期',
  `funding`       DECIMAL(12,2)                        COMMENT '经费金额（元）',
  `source`        VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '经费来源 / 资助单位',
  `remark`        VARCHAR(500) NOT NULL DEFAULT ''     COMMENT '备注',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_group_status` (`group_id`, `status`),
  KEY `idx_leader` (`leader_id`),
  KEY `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题表';
