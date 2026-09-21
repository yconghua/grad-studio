-- 消息中心表（个人主页 → 消息中心）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `message` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `receiver_id` INT UNSIGNED NOT NULL                COMMENT '接收人用户 id（软关联 user.id）',
  `sender_id`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '发送人用户 id（NULL=系统消息）',
  `title`       VARCHAR(200) NULL DEFAULT NULL       COMMENT '标题',
  `content`     TEXT         NULL                    COMMENT '内容',
  `type`        VARCHAR(20)  NULL DEFAULT NULL       COMMENT '类型（系统通知 / 审批提醒 / 回复提醒 / mention 等）',
  `biz_type`    VARCHAR(30)  NULL DEFAULT NULL       COMMENT '关联业务类型：task/comment/approval/weekly_report 等',
  `biz_id`      INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联业务 id（配合 biz_type 跳转）',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'unread' COMMENT '状态：unread 未读 / read 已读',
  `read_at`     DATETIME     NULL DEFAULT NULL       COMMENT '阅读时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`),
  KEY `idx_receiver_id` (`receiver_id`),
  KEY `idx_status` (`status`),
  KEY `idx_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息中心表';
