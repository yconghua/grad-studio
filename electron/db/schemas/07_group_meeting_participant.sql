-- 组会参与人表：会议与用户的关联（会中角色主持/汇报/参与首版留空）。
-- 参与人由发布者指定，不做参与确认；仅本组启用状态的导师/学生可选。
-- 同人同会仅一条（唯一键幂等）；删除会议 / 删除课题组时由应用级联删除本表记录。
CREATE TABLE IF NOT EXISTS `group_meeting_participant` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '参与记录ID',
  `meeting_id`      BIGINT       NOT NULL COMMENT '会议ID',
  `user_id`         BIGINT       NOT NULL COMMENT '参与人用户ID（仅本组启用导师/学生）',
  `role_in_meeting` VARCHAR(20)  NULL COMMENT '会中角色：主持/汇报/参与（首版留空）',
  `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_meeting_user` (`meeting_id`, `user_id`),
  KEY `idx_meeting_id` (`meeting_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会参与人表';
