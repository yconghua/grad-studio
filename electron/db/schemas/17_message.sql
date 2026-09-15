-- 站内信（模块10 通知公告 - 消息通知）
-- 本期唯一的推送渠道：审批提醒、截止提醒、组会提醒、公告发布全部落这张表。
-- 不接邮件与微信钉钉，故不存外部推送状态字段。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `message` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `to_member_id`   INT UNSIGNED NOT NULL                COMMENT '收件人 member.id',
  `from_member_id` INT UNSIGNED DEFAULT NULL            COMMENT '发件人 member.id，系统自动发送时为空',
  `title`          VARCHAR(200) NOT NULL                COMMENT '标题',
  `content`        VARCHAR(500) DEFAULT NULL            COMMENT '内容',
  `type`           VARCHAR(20)  NOT NULL DEFAULT '系统通知' COMMENT '类型：系统通知 / 审批提醒 / 截止提醒 / 组会提醒',
  `biz_type`       VARCHAR(20)  DEFAULT NULL            COMMENT '关联业务类型，用于点击跳转，可为空',
  `biz_id`         INT UNSIGNED DEFAULT NULL            COMMENT '关联业务主键，可为空',
  `is_read`        TINYINT      NOT NULL DEFAULT 0      COMMENT '是否已读：0 未读 / 1 已读',
  `read_time`      DATETIME     DEFAULT NULL            COMMENT '已读时间',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`),
  KEY `idx_to_read` (`to_member_id`, `is_read`),
  KEY `idx_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内信表';
