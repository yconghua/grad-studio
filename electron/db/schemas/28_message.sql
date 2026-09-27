-- 站内消息表：顶部铃铛消息中心
-- 幂等：重复执行无副作用。
-- 说明：系统 / 业务模块（组会提醒、任务下发、成果审核结果、公告）向用户发消息；
--   未读数 = 接收人 status='unread' 的记录数；ref_type / ref_id 可跳转关联业务对象。
CREATE TABLE IF NOT EXISTS `message` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sender_id`     INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '发送人 user.id（0 表示系统消息）',
  `receiver_id`   INT UNSIGNED NOT NULL                COMMENT '接收人 user.id',
  `msg_type`      VARCHAR(20)  NOT NULL DEFAULT 'system' COMMENT '类型：system 系统 / notice 公告 / meeting 组会 / task 任务 / achievement 成果审核 / other 其他',
  `title`         VARCHAR(200) NOT NULL DEFAULT ''     COMMENT '消息标题',
  `content`       TEXT                                 COMMENT '消息内容',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'unread' COMMENT '状态：unread 未读 / read 已读',
  `ref_type`      VARCHAR(30)  NOT NULL DEFAULT ''     COMMENT '关联业务类型（如 notice / meeting / task）',
  `ref_id`        INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '关联业务 id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `read_at`       DATETIME                             COMMENT '已读时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_receiver_status` (`receiver_id`, `status`),
  KEY `idx_msg_type` (`msg_type`),
  KEY `idx_ref` (`ref_type`, `ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内消息表';
